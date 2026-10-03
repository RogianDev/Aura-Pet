import { create } from 'zustand';

interface UiState {
  isChatOpen: boolean;
  isSettingsOpen: boolean;
  toggleChat: () => void;
  toggleSettings: () => void;
  closeAll: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isChatOpen: false,
  isSettingsOpen: false,
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen, isSettingsOpen: false })),
  toggleSettings: () =>
    set((s) => ({ isSettingsOpen: !s.isSettingsOpen, isChatOpen: false })),
  closeAll: () => set({ isChatOpen: false, isSettingsOpen: false }),
}));