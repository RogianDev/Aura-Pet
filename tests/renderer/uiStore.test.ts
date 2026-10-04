import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../../src/renderer/stores/uiStore';

describe('useUiStore', () => {
  beforeEach(() => {
    useUiStore.getState().closeAll();
  });

  it('arranca con todos los paneles cerrados', () => {
    expect(useUiStore.getState()).toMatchObject({
      isChatOpen: false,
      isSettingsOpen: false,
      activePanel: null,
    });
  });

  it('toggleChat abre el chat', () => {
    useUiStore.getState().toggleChat();

    expect(useUiStore.getState()).toMatchObject({
      isChatOpen: true,
      isSettingsOpen: false,
      activePanel: 'chat',
    });
  });

  it('toggleChat sobre el chat abierto lo cierra', () => {
    useUiStore.getState().toggleChat();
    useUiStore.getState().toggleChat();

    expect(useUiStore.getState()).toMatchObject({
      isChatOpen: false,
      activePanel: null,
    });
  });

  it('toggleSettings abre los ajustes', () => {
    useUiStore.getState().toggleSettings();

    expect(useUiStore.getState()).toMatchObject({
      isChatOpen: false,
      isSettingsOpen: true,
      activePanel: 'settings',
    });
  });

  it('toggleSettings sobre los ajustes abiertos los cierra', () => {
    useUiStore.getState().toggleSettings();
    useUiStore.getState().toggleSettings();

    expect(useUiStore.getState()).toMatchObject({
      isSettingsOpen: false,
      activePanel: null,
    });
  });

  it('los paneles son mutuamente excluyentes', () => {
    useUiStore.getState().toggleChat();
    useUiStore.getState().toggleSettings();

    expect(useUiStore.getState()).toMatchObject({
      isChatOpen: false,
      isSettingsOpen: true,
      activePanel: 'settings',
    });
  });

  it('openPanel abre el panel indicado', () => {
    useUiStore.getState().openPanel('settings');

    expect(useUiStore.getState().isSettingsOpen).toBe(true);
  });

  it('closePanel cierra el panel indicado', () => {
    useUiStore.getState().openPanel('chat');
    useUiStore.getState().closePanel('chat');

    expect(useUiStore.getState()).toMatchObject({
      isChatOpen: false,
      activePanel: null,
    });
  });

  it('closePanel no toca el panel que no es el indicado', () => {
    useUiStore.getState().openPanel('chat');
    useUiStore.getState().closePanel('settings');

    expect(useUiStore.getState().isChatOpen).toBe(true);
  });

  it('closePanel sin argumento cierra todos', () => {
    useUiStore.getState().openPanel('chat');
    useUiStore.getState().closePanel();

    expect(useUiStore.getState()).toMatchObject({
      isChatOpen: false,
      isSettingsOpen: false,
      activePanel: null,
    });
  });

  it('closeAll cierra todos los paneles', () => {
    useUiStore.getState().openPanel('settings');
    useUiStore.getState().closeAll();

    expect(useUiStore.getState()).toMatchObject({
      isChatOpen: false,
      isSettingsOpen: false,
      activePanel: null,
    });
  });

  it('nunca deja los dos paneles abiertos a la vez', () => {
    const { toggleChat, toggleSettings, closeAll } = useUiStore.getState();
    const secuencias: Array<() => void> = [toggleChat, toggleSettings, closeAll];

    for (const accion of secuencias) {
      for (const siguiente of secuencias) {
        accion();
        siguiente();

        const { isChatOpen, isSettingsOpen } = useUiStore.getState();
        expect(isChatOpen && isSettingsOpen).toBe(false);
      }
    }
  });

  it('isChatOpen e isSettingsOpen nunca contradicen a activePanel', () => {
    const { toggleChat, toggleSettings, closeAll, openPanel } = useUiStore.getState();
    const secuencias: Array<() => void> = [
      toggleChat,
      toggleSettings,
      closeAll,
      () => openPanel('chat'),
      () => openPanel('settings'),
    ];

    for (const accion of secuencias) {
      for (const siguiente of secuencias) {
        accion();
        siguiente();

        const { isChatOpen, isSettingsOpen, activePanel } = useUiStore.getState();
        expect(isChatOpen).toBe(activePanel === 'chat');
        expect(isSettingsOpen).toBe(activePanel === 'settings');
      }
    }
  });
});