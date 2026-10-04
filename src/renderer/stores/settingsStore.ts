import { create } from 'zustand';
import type { Settings } from '@shared/contracts';
import { clamp } from '../utils/math';

interface SettingsState {
  settings: Settings;
  /** `true` en cuanto se ha intentado leer los ajustes del proceso Main. */
  isHydrated: boolean;
  setSettings: (settings: Settings) => void;
  patch: (partial: Partial<Settings>) => void;
  /** Cambia el volumen recortando al intervalo 0..1. */
  setVolume: (volume: number) => void;
  /** Lee los ajustes de Main (fuente de verdad) sin bloquear la interfaz. */
  hydrate: () => Promise<void>;
  /** Aplica el cambio en local y lo refleja en Main. */
  persist: (partial: Partial<Settings>) => Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
  volume: 0.7,
};

/**
 * Sanea los ajustes recibidos: recorte del volumen y textos no vacios.
 * Main podria devolver valores corruptos (disco editado a mano, migracion...).
 */
export function normalizeSettings(settings: Settings): Settings {
  return {
    ...settings,
    ollamaBaseUrl: settings.ollamaBaseUrl.trim() || DEFAULT_SETTINGS.ollamaBaseUrl,
    ollamaModel: settings.ollamaModel.trim() || DEFAULT_SETTINGS.ollamaModel,
    volume: clamp(settings.volume, 0, 1),
  };
}

/** `window.aurapetAPI` no existe fuera de Electron (tests, navegador suelto). */
function getApi(): Window['aurapetAPI'] | undefined {
  return typeof window === 'undefined' ? undefined : window.aurapetAPI;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isHydrated: false,

  setSettings: (settings) => set({ settings: normalizeSettings(settings) }),

  patch: (partial) =>
    set((s) => ({ settings: normalizeSettings({ ...s.settings, ...partial }) })),

  setVolume: (volume) => get().patch({ volume }),

  hydrate: async () => {
    const api = getApi();
    if (!api) {
      set({ isHydrated: true });
      return;
    }
    try {
      const settings = await api.settings.getAll();
      set({ settings: normalizeSettings(settings), isHydrated: true });
    } catch (error) {
      // Main es la fuente de verdad, pero un fallo no debe romper la app:
      // se conservan los valores por defecto.
      console.error('[AuraPet] No se pudieron leer los ajustes de Main:', error);
      set({ isHydrated: true });
    }
  },

  persist: async (partial) => {
    // Actualizacion optimista: la interfaz responde al instante.
    get().patch(partial);

    const api = getApi();
    if (!api) return;

    try {
      const settings = await api.settings.update(partial);
      set({ settings: normalizeSettings(settings) });
    } catch (error) {
      console.error('[AuraPet] No se pudieron guardar los ajustes en Main:', error);
    }
  },
}));