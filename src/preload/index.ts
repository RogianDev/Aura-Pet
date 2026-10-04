import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type AuraPetAPI, type PetMood } from '../shared/contracts';

/**
 * Preload — Capa de puente (seccion 4.1 del PDR).
 *
 * Actua como firewall estricto: expone UNICAMENTE la API de abajo.
 * No se expone ipcRenderer ni ningun modulo de Node al renderer.
 * nodeIntegration esta desactivado y contextIsolation activo (RNF-02).
 */
const api: AuraPetAPI = {
  pet: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.PET_GET_STATE),
    setMood: (mood: PetMood) => ipcRenderer.send(IPC_CHANNELS.PET_SET_MOOD, mood),
    onMoodChange: (callback: (mood: PetMood) => void) => {
      // Envolvente: el renderer nunca recibe el objeto IpcRendererEvent,
      // que expone `sender` y podria usarse para Saltarse el firewall (§4.1).
      const listener = (_event: unknown, mood: PetMood): void => callback(mood);
      ipcRenderer.on(IPC_CHANNELS.PET_MOOD_CHANGED, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.PET_MOOD_CHANGED, listener);
    },
  },
  settings: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),
    update: (partial) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, partial),
  },
  ai: {
    listProviders: () => ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_PROVIDERS),
    setApiKey: (provider, key) => ipcRenderer.invoke(IPC_CHANNELS.AI_SET_API_KEY, provider, key),
    deleteApiKey: (provider) => ipcRenderer.invoke(IPC_CHANNELS.AI_DELETE_API_KEY, provider),
    isSecureStorageAvailable: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_SECURE_STORAGE_AVAILABLE),
  },
  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
  },
};

contextBridge.exposeInMainWorld('aurapetAPI', api);

// Object.freeze defensivo: impide que el renderer reescriba la API.
Object.freeze(api);