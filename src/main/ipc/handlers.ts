import { ipcMain, app } from 'electron';
import { IPC_CHANNELS, type PetState, type Settings } from '../../shared/contracts';
import type { WindowManager } from '../window/WindowManager';

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

const settings: Settings = {
  provider: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
  volume: 0.7,
};

export function registerIpcHandlers(_windowManager: WindowManager): void {
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
}