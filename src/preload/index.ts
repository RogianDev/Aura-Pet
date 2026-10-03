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
  },
  settings: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),
    update: (partial) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, partial),
  },
  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
  },
};

contextBridge.exposeInMainWorld('aurapetAPI', api);

// Object.freeze defensivo: impide que el renderer reescriba la API.
Object.freeze(api);