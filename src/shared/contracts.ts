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
  /** Push de Main -> Renderer: el animo cambio (eventos de CLI). */
  PET_MOOD_CHANGED: 'pet:mood-changed',
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_UPDATE: 'settings:update',
  APP_GET_VERSION: 'app:get-version',
  /** Sprint 3: que proveedores de IA hay y cuales estan configurados. */
  AI_LIST_PROVIDERS: 'ai:list-providers',
  /** Sprint 3: guarda una clave de API cifrada. Nunca se devuelve su valor. */
  AI_SET_API_KEY: 'ai:set-api-key',
  AI_DELETE_API_KEY: 'ai:delete-api-key',
  /** Sprint 3: si el cifrado del sistema esta disponible. */
  AI_SECURE_STORAGE_AVAILABLE: 'ai:secure-storage-available',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** Estados de animo de la mascota (RF-02). */
export type PetMood = 'idle' | 'happy' | 'curious' | 'sleepy' | 'alert';

export interface PetState {
  mood: PetMood;
  /** Posicion normalizada del cursor respecto a la ventana (-1..1). */
  cursor: { x: number; y: number };
}

/**
 * Eventos de CLI recibidos por el servidor WebSocket (RF-05).
 *
 * Este bloque es ADITIVO: no modifica ningun tipo existente, de modo que el
 * trabajo de Dev B en src/renderer/ sigue siendo compatible (seccion 11.3 del PDR).
 */

/** Tipos de evento aceptados por el servidor. Lista blanca (diseno aprobado). */
export const CLI_EVENT_TYPES = ['cli.command.started', 'cli.command.finished'] as const;

export type CliEventType = (typeof CLI_EVENT_TYPES)[number];

/** Payload de `cli.command.started`. */
export interface CliCommandStartedData {
  /** Comando que la CLI va a ejecutar. No debe incluir secretos. */
  command: string;
}

/** Payload de `cli.command.finished`. */
export interface CliCommandFinishedData {
  command: string;
  /** Codigo de salida: 0 = correcto, distinto de 0 = fallo. */
  exitCode: number;
}

/** Envelope comun a todos los eventos de CLI. */
export interface CliEvent<T extends CliEventType = CliEventType> {
  type: T;
  /** ISO 8601. Opcional: si falta, el servidor lo completa. */
  timestamp?: string;
  data: T extends 'cli.command.started'
    ? CliCommandStartedData
    : T extends 'cli.command.finished'
      ? CliCommandFinishedData
      : never;
}

/** Tamano maximo de un mensaje WebSocket (64 KB). */
export const CLI_EVENT_MAX_BYTES = 64 * 1024;

/** Puerto por defecto del servidor local de la CLI. */
export const CLI_EVENTS_PORT = 9001;

/** Timeout de inactividad antes de cerrar una conexion zombi (ms). */
export const CLI_EVENTS_IDLE_TIMEOUT_MS = 30_000;

export interface Settings {
  /** Proveedor de IA activo. */
  provider: 'openai' | 'anthropic' | 'ollama' | 'lmstudio';
  ollamaBaseUrl: string;
  ollamaModel: string;
  /** Volumen de la voz de la mascota (0..1). */
  volume: number;
}

/** API expuesta en el renderer via contextBridge (RNF-02). */
/** Informacion de un proveedor expuesta al renderer (Sprint 3). */
export interface ProviderInfo {
  id: string;
  label: string;
  /** Si el usuario ya guardo una clave para este proveedor. */
  configured: boolean;
  /** Si es de pago: la UI debe avisarlo antes de pedir la clave. */
  requiresApiKey: boolean;
}

export interface AuraPetAPI {
  pet: {
    getState(): Promise<PetState>;
    setMood(mood: PetMood): void;
    /**
     * Suscribe el renderer a los cambios de animo enviados por Main
     * (eventos de CLI, RF-05). Devuelve una funcion para cancelar.
     */
    onMoodChange(callback: (mood: PetMood) => void): () => void;
  };
  settings: {
    getAll(): Promise<Settings>;
    update(partial: Partial<Settings>): Promise<Settings>;
  };
  /**
   * Sprint 3 — Configuracion de IA.
   *
   * El renderer NUNCA recibe el valor de una clave: solo puede guardarla,
   * borrarla o preguntar si existe. Es la garantia de que una clave no acaba
   * en la UI ni en un log.
   */
  ai: {
    listProviders(): Promise<ProviderInfo[]>;
    setApiKey(provider: string, key: string): Promise<ProviderInfo[]>;
    deleteApiKey(provider: string): Promise<ProviderInfo[]>;
    /** Indica si el cifrado del sistema esta disponible. */
    isSecureStorageAvailable(): Promise<boolean>;
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