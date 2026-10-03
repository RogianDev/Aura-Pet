/**
 * Contratos compartidos entre el proceso Main y el Renderer.
 * Cualquier cambio aqui requiere actualizar:
 *  - el preload (src/preload/index.ts)
 *  - los handlers IPC (src/main/ipc/handlers.ts)
 */

/** Canales IPC registrados en el preload. */
export const IPC_CHANNELS = {
  PET_GET_STATE: 'pet:get-state',
  PET_SET_MOOD: 'pet:set-mood',
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_UPDATE: 'settings:update',
  APP_GET_VERSION: 'app:get-version',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** Estados de animo de la mascota (RF-02). */
export type PetMood = 'idle' | 'happy' | 'curious' | 'sleepy' | 'alert';

export interface PetState {
  mood: PetMood;
  /** Posicion normalizada del cursor respecto a la ventana (-1..1). */
  cursor: { x: number; y: number };
}

export interface Settings {
  /** Proveedor de IA activo. */
  provider: 'openai' | 'anthropic' | 'ollama' | 'lmstudio';
  ollamaBaseUrl: string;
  ollamaModel: string;
  /** Volumen de la voz de la mascota (0..1). */
  volume: number;
}

/** API expuesta en el renderer via contextBridge (RNF-02). */
export interface AuraPetAPI {
  pet: {
    getState(): Promise<PetState>;
    setMood(mood: PetMood): void;
  };
  settings: {
    getAll(): Promise<Settings>;
    update(partial: Partial<Settings>): Promise<Settings>;
  };
  app: {
    getVersion(): Promise<string>;
  };
}

declare global {
  interface Window {
    aurapetAPI: AuraPetAPI;
  }
}