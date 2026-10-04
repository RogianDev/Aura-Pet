import { ipcMain, app } from 'electron';
import { IPC_CHANNELS, type PetState, type ProviderInfo, type Settings } from '../../shared/contracts';
import type { WindowManager } from '../window/WindowManager';
import { SecureStore } from '../storage/SecureStore';
import { availableProviders, isProviderConfigured } from '../ai-providers';
import type { AIProviderId } from '../ai-providers/AIProvider';

/**
 * Handlers IPC — Capa de dominio / casos de uso (seccion 4.2 del PDR).
 *
 * Ningun handler expone Node.js ni el sistema de archivos al renderer:
 * cada canal declara explicitamente lo que devuelve.
 */

/** Estado en memoria. Se movera a disco con safeStorage en el Sprint 3. */
const petState: PetState = {
  mood: 'idle',
  cursor: { x: 0, y: 0 },
};

/** Estado de ajustes. Las claves de IA NO viven aqui: van cifradas en SecureStore. */
const settings: Settings = {
  provider: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
  volume: 0.7,
};

/** Almacén cifrado de credenciales. */
const secureStore = new SecureStore();

/** Etiquetas legibles para el panel de ajustes. */
const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI (nube, requiere clave)',
  anthropic: 'Anthropic (nube, requiere clave)',
  ollama: 'Ollama (local, sin clave)',
  lmstudio: 'LM Studio (local, sin clave)',
};

/**
 * Lista los proveedores y si estan configurados.
 *
 * Devuelve solo el booleano `configured`: el valor de la clave nunca sale de
 * Main. Si se devolviera, la clave acabaria en el renderer y en cualquier log.
 */
function listProviders(): ProviderInfo[] {
  return availableProviders().map((id) => ({
    id,
    label: PROVIDER_LABELS[id] ?? id,
    configured: isProviderConfigured(id, secureStore),
    requiresApiKey: id === 'openai' || id === 'anthropic',
  }));
}

function isKnownProvider(id: string): id is AIProviderId {
  return availableProviders().includes(id as AIProviderId);
}

/**
 * Ventana activa usada para notificar cambios de animo al renderer.
 * Se registra al crear la ventana para que applyPetMood pueda enviar el push.
 */
let activeWindow: WindowManager | null = null;

/** Registra el WindowManager que gestionara las notificaciones push. */
export function setActiveWindowManager(manager: WindowManager): void {
  activeWindow = manager;
}

/**
 * Actualiza el animo de la mascota desde el proceso Main.
 * Lo invoca el servidor de eventos de la CLI (RF-05) para que los cambios
 * de estado lleguen al renderer sin que este tenga que escuchar el WebSocket.
 *
 * Ademas de guardar el estado, ENVIA el cambio a la ventana: sin esta
 * notificacion el renderer no se enteraria hasta que se recargara.
 */
export function applyPetMood(mood: PetState['mood']): void {
  const valid: PetState['mood'][] = ['idle', 'happy', 'curious', 'sleepy', 'alert'];
  if (!valid.includes(mood)) return;

  petState.mood = mood;

  const window = activeWindow?.getMainWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send(IPC_CHANNELS.PET_MOOD_CHANGED, mood);
  }
}

export function registerIpcHandlers(windowManager: WindowManager): void {
  setActiveWindowManager(windowManager);
  // ---- Mascota (RF-02) ----
  ipcMain.handle(IPC_CHANNELS.PET_GET_STATE, (): PetState => {
    return { ...petState, cursor: { ...petState.cursor } };
  });

  ipcMain.on(IPC_CHANNELS.PET_SET_MOOD, (_event, mood: PetState['mood']) => {
    const valid: PetState['mood'][] = ['idle', 'happy', 'curious', 'sleepy', 'alert'];
    if (valid.includes(mood)) {
      petState.mood = mood;
    }
  });

  // ---- Ajustes (RF-03) ----
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, (): Settings => {
    return { ...settings };
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_UPDATE,
    (_event, partial: Partial<Settings>): Settings => {
      Object.assign(settings, partial);
      return { ...settings };
    },
  );

  // ---- App ----
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, (): string => {
    return app.getVersion();
  });

  // ---- IA (Sprint 3) ----
  // Ninguno de estos handlers devuelve el valor de una clave: solo si existe.
  ipcMain.handle(IPC_CHANNELS.AI_LIST_PROVIDERS, (): ProviderInfo[] => {
    return listProviders();
  });

  ipcMain.handle(
    IPC_CHANNELS.AI_SET_API_KEY,
    (_event, provider: string, key: string): ProviderInfo[] => {
      if (!isKnownProvider(provider)) {
        throw new Error(`Proveedor desconocido: ${provider}`);
      }
      const value = String(key ?? '').trim();
      if (value.length === 0) {
        throw new Error('La clave no puede estar vacia.');
      }
      if (!SecureStore.isAvailable()) {
        throw new Error(
          'El cifrado del sistema no esta disponible: no se guardan claves en claro.',
        );
      }
      secureStore.set(`apiKey:${provider}`, value);
      return listProviders();
    },
  );

  ipcMain.handle(IPC_CHANNELS.AI_DELETE_API_KEY, (_event, provider: string): ProviderInfo[] => {
    if (!isKnownProvider(provider)) {
      throw new Error(`Proveedor desconocido: ${provider}`);
    }
    secureStore.delete(`apiKey:${provider}`);
    return listProviders();
  });

  ipcMain.handle(IPC_CHANNELS.AI_SECURE_STORAGE_AVAILABLE, (): boolean => {
    return SecureStore.isAvailable();
  });
}