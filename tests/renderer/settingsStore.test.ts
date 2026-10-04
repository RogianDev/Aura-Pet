import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  useSettingsStore,
} from '../../src/renderer/stores/settingsStore';
import type { AuraPetAPI, Settings } from '../../src/shared/contracts';

/**
 * En entorno `node` no existe `window`, que es justo lo que el store comprueba
 * antes de hablar con Main. Aqui se instala una `window` de mentira para poder
 * verificar los dos caminos: con API disponible y sin ella.
 */
type TestGlobals = { window?: { aurapetAPI?: unknown } };

function installWindow(api: AuraPetAPI | undefined): void {
  (globalThis as unknown as TestGlobals).window = { aurapetAPI: api };
}

function removeWindow(): void {
  delete (globalThis as unknown as TestGlobals).window;
}

/** API de Main simulada, con los ajustes en memoria como en el proceso real. */
function createFakeApi(initial: Partial<Settings> = {}): AuraPetAPI {
  let current: Settings = { ...DEFAULT_SETTINGS, ...initial };

  return {
    settings: {
      getAll: vi.fn(async () => ({ ...current })),
      update: vi.fn(async (partial: Partial<Settings>) => {
        current = { ...current, ...partial };
        return { ...current };
      }),
    },
  } as unknown as AuraPetAPI;
}

describe('normalizeSettings', () => {
  it('recorta el volumen al intervalo 0..1', () => {
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, volume: 5 }).volume).toBe(1);
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, volume: -2 }).volume).toBe(0);
  });

  it('sustituye textos vacios o en blanco por los valores por defecto', () => {
    const result = normalizeSettings({
      ...DEFAULT_SETTINGS,
      ollamaBaseUrl: '   ',
      ollamaModel: '',
    });

    expect(result.ollamaBaseUrl).toBe(DEFAULT_SETTINGS.ollamaBaseUrl);
    expect(result.ollamaModel).toBe(DEFAULT_SETTINGS.ollamaModel);
  });

  it('conserva un texto valido', () => {
    const result = normalizeSettings({ ...DEFAULT_SETTINGS, ollamaModel: 'llama3' });

    expect(result.ollamaModel).toBe('llama3');
  });
});

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS }, isHydrated: false });
  });

  afterEach(() => {
    removeWindow();
    vi.restoreAllMocks();
  });

  it('arranca con los ajustes por defecto y sin hidratar', () => {
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(useSettingsStore.getState().isHydrated).toBe(false);
  });

  it('patch hace merge parcial', () => {
    useSettingsStore.getState().patch({ volume: 0.2 });

    expect(useSettingsStore.getState().settings).toEqual({
      ...DEFAULT_SETTINGS,
      volume: 0.2,
    });
  });

  it('setVolume recorta al intervalo 0..1', () => {
    useSettingsStore.getState().setVolume(4);
    expect(useSettingsStore.getState().settings.volume).toBe(1);

    useSettingsStore.getState().setVolume(-1);
    expect(useSettingsStore.getState().settings.volume).toBe(0);
  });

  it('hydrate carga los ajustes que tiene Main', async () => {
    const api = createFakeApi({ ollamaModel: 'qwen2.5', volume: 0.3 });
    installWindow(api);

    await useSettingsStore.getState().hydrate();

    expect(api.settings.getAll).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().settings.ollamaModel).toBe('qwen2.5');
    expect(useSettingsStore.getState().isHydrated).toBe(true);
  });

  it('hydrate sanea lo que devuelve Main', async () => {
    const api = createFakeApi({ volume: 9 });
    installWindow(api);

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().settings.volume).toBe(1);
  });

  it('hydrate marca isHydrated aunque Main falle, y conserva los valores', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = {
      settings: { getAll: vi.fn().mockRejectedValue(new Error('Main no responde')) },
    } as unknown as AuraPetAPI;
    installWindow(api);

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().isHydrated).toBe(true);
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
  });

  it('hydrate no falla si no hay API disponible', async () => {
    removeWindow();

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().isHydrated).toBe(true);
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
  });

  it('persist aplica el cambio en local y lo envia a Main', async () => {
    const api = createFakeApi();
    installWindow(api);

    await useSettingsStore.getState().persist({ volume: 0.2 });

    expect(api.settings.update).toHaveBeenCalledWith({ volume: 0.2 });
    expect(useSettingsStore.getState().settings.volume).toBe(0.2);
  });

  it('persist respeta la respuesta de Main', async () => {
    // Main podria corregir el valor (recortar, normalizar o poner su defecto).
    const api = {
      settings: {
        update: vi.fn(async () => ({ ...DEFAULT_SETTINGS, volume: 1 })),
      },
    } as unknown as AuraPetAPI;
    installWindow(api);

    await useSettingsStore.getState().persist({ volume: 0.2 });

    expect(useSettingsStore.getState().settings.volume).toBe(1);
  });

  it('persist mantiene el cambio local si Main falla', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = {
      settings: { update: vi.fn().mockRejectedValue(new Error('disco lleno')) },
    } as unknown as AuraPetAPI;
    installWindow(api);

    await useSettingsStore.getState().persist({ volume: 0.2 });

    expect(useSettingsStore.getState().settings.volume).toBe(0.2);
  });

  it('persist funciona sin API disponible', async () => {
    removeWindow();

    await useSettingsStore.getState().persist({ volume: 0.1 });

    expect(useSettingsStore.getState().settings.volume).toBe(0.1);
  });
});