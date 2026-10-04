import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IPC_CHANNELS } from '../src/shared/contracts';

/**
 * Test de los handlers IPC (matriz de calidad, seccion 5 del PDR).
 * Verifica el contrato Main <-> Preload sin levantar Electron.
 */

// Registro en memoria de los handlers registrados por registerIpcHandlers.
const registry = new Map<string, (...args: unknown[]) => unknown>();
const sent = new Map<string, unknown>();

/** Mensajes push enviados de Main -> Renderer (RF-05). */
const pushed: Array<{ channel: string; payload: unknown }> = [];

const mockedApp = { getVersion: () => '1.3.0' };

/**
 * WindowManager simulado: captura los pushes que Main envia al renderer.
 * Sin esto, applyPetMood mutaria el estado pero nadie lo recibiria, que fue
 * exactamente el fallo que hizo que la funcionase visiblemente.
 */
const fakeWindow = {
  isDestroyed: () => false,
  webContents: {
    send: (channel: string, payload: unknown) => pushed.push({ channel, payload }),
  },
};

const windowManagerStub = { getMainWindow: () => fakeWindow } as never;

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => registry.set(channel, fn),
    on: (channel: string, fn: (event: unknown, payload: unknown) => void) => {
      sent.set(channel, fn);
    },
  },
  app: mockedApp,
}));

const { registerIpcHandlers: registerInitial } = await import('../src/main/ipc/handlers');
void registerInitial;

describe('IPC handlers', () => {
  beforeEach(async () => {
    registry.clear();
    sent.clear();
    pushed.length = 0;
    // El estado de la mascota vive en el modulo: hay que recargarlo
    // para que cada test parta del estado inicial.
    vi.resetModules();
    const mod = await import('../src/main/ipc/handlers');
    mod.registerIpcHandlers(windowManagerStub);
  });

  it('registra todos los canales definidos en el contrato', () => {
    for (const channel of Object.values(IPC_CHANNELS)) {
      // PET_MOOD_CHANGED es un canal de push: lo emite Main, no lo registra
      // el renderer, asi que no aparece en registry ni en sent.
      if (channel === IPC_CHANNELS.PET_MOOD_CHANGED) continue;
      expect(registry.has(channel) || sent.has(channel)).toBe(true);
    }
  });

  it('applyPetMood notifica al renderer con PET_MOOD_CHANGED', async () => {
    const { applyPetMood } = await import('../src/main/ipc/handlers');
    applyPetMood('alert');

    expect(pushed).toHaveLength(1);
    expect(pushed[0]?.channel).toBe(IPC_CHANNELS.PET_MOOD_CHANGED);
    expect(pushed[0]?.payload).toBe('alert');

    // Y el estado tambien queda actualizado para getState().
    const handler = registry.get(IPC_CHANNELS.PET_GET_STATE);
    expect(await handler?.()).toMatchObject({ mood: 'alert' });
  });

  it('applyPetMood ignora animos invalidos y no notifica', async () => {
    const { applyPetMood } = await import('../src/main/ipc/handlers');
    applyPetMood('no-es-un-animo' as never);
    expect(pushed).toHaveLength(0);
  });

  it('PET_GET_STATE devuelve el estado inicial en idle', async () => {
    const handler = registry.get(IPC_CHANNELS.PET_GET_STATE);
    expect(await handler?.()).toMatchObject({ mood: 'idle' });
  });

  it('PET_SET_MOOD actualiza el estado del animo', async () => {
    const listener = sent.get(IPC_CHANNELS.PET_SET_MOOD) as (e: unknown, mood: string) => void;
    listener({}, 'happy');
    const handler = registry.get(IPC_CHANNELS.PET_GET_STATE);
    expect(await handler?.()).toMatchObject({ mood: 'happy' });
  });

  it('PET_SET_MOOD ignora animos no validos', async () => {
    const listener = sent.get(IPC_CHANNELS.PET_SET_MOOD) as (e: unknown, mood: string) => void;
    listener({}, 'no-es-un-animo');
    const handler = registry.get(IPC_CHANNELS.PET_GET_STATE);
    expect(await handler?.()).toMatchObject({ mood: 'idle' });
  });

  it('SETTINGS_UPDATE hace merge parcial y devuelve los ajustes', async () => {
    const handler = registry.get(IPC_CHANNELS.SETTINGS_UPDATE);
    const result = (await handler?.({}, { volume: 0.2 })) as { volume: number; provider: string };
    expect(result.volume).toBe(0.2);
    // El resto de campos debe conservarse.
    expect(result.provider).toBe('ollama');
  });

  it('APP_GET_VERSION devuelve la version de la app', async () => {
    const handler = registry.get(IPC_CHANNELS.APP_GET_VERSION);
    expect(await handler?.()).toBe('1.3.0');
  });
});