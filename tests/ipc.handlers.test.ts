import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IPC_CHANNELS } from '../src/shared/contracts';

/**
 * Test de los handlers IPC (matriz de calidad, seccion 5 del PDR).
 * Verifica el contrato Main <-> Preload sin levantar Electron.
 */

// Registro en memoria de los handlers registrados por registerIpcHandlers.
const registry = new Map<string, (...args: unknown[]) => unknown>();
const sent = new Map<string, unknown>();

const mockedApp = { getVersion: () => '1.3.0' };

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

const windowManagerStub = {} as never;

describe('IPC handlers', () => {
  beforeEach(async () => {
    registry.clear();
    sent.clear();
    // El estado de la mascota vive en el modulo: hay que recargarlo
    // para que cada test parta del estado inicial.
    vi.resetModules();
    const mod = await import('../src/main/ipc/handlers');
    mod.registerIpcHandlers(windowManagerStub);
  });

  it('registra todos los canales definidos en el contrato', () => {
    for (const channel of Object.values(IPC_CHANNELS)) {
      expect(registry.has(channel) || sent.has(channel)).toBe(true);
    }
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