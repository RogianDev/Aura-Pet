import { create } from 'zustand';

/** Paneles de la interfaz (RF-03). `null` = ninguno desplegado. */
export type UiPanel = 'chat' | 'settings' | null;
export type UiPanelName = Exclude<UiPanel, null>;

interface UiState {
  isChatOpen: boolean;
  isSettingsOpen: boolean;
  /** Fuente de verdad: evita que los dos booleanos se desincronicen. */
  activePanel: UiPanel;
  toggleChat: () => void;
  toggleSettings: () => void;
  /** Abre un panel cerrando el otro (son mutuamente excluyentes). */
  openPanel: (panel: UiPanelName) => void;
  /** Cierra el panel indicado, o todos si se omite. */
  closePanel: (panel?: UiPanelName) => void;
  closeAll: () => void;
}

/** Estado correspondiente a "no hay ningun panel desplegado". */
const CLOSED: Pick<UiState, 'isChatOpen' | 'isSettingsOpen' | 'activePanel'> = {
  isChatOpen: false,
  isSettingsOpen: false,
  activePanel: null,
};

/** Estado correspondiente a un panel concreto (`null` = cerrado). */
function panelState(panel: UiPanel): Pick<
  UiState,
  'isChatOpen' | 'isSettingsOpen' | 'activePanel'
> {
  return {
    isChatOpen: panel === 'chat',
    isSettingsOpen: panel === 'settings',
    activePanel: panel,
  };
}

export const useUiStore = create<UiState>((set) => ({
  ...CLOSED,

  toggleChat: () =>
    set((s) => panelState(s.activePanel === 'chat' ? null : 'chat')),

  toggleSettings: () =>
    set((s) => panelState(s.activePanel === 'settings' ? null : 'settings')),

  openPanel: (panel) => set(panelState(panel)),

  closePanel: (panel) =>
    set((s) => (panel && s.activePanel !== panel ? s : CLOSED)),

  closeAll: () => set(CLOSED),
}));