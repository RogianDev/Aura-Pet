import { create } from 'zustand';
import type { Settings } from '@shared/contracts';

interface SettingsState {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  patch: (partial: Partial<Settings>) => void;
}

const DEFAULTS: Settings = {
  provider: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
  volume: 0.7,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULTS,
  setSettings: (settings) => set({ settings }),
  patch: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
}));