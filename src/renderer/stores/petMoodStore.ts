import { create } from 'zustand';
import type { PetMood } from '@shared/contracts';

interface PetMoodState {
  mood: PetMood;
  /** Posicion normalizada del cursor respecto a la ventana (-1..1). */
  cursor: { x: number; y: number };
  setMood: (mood: PetMood) => void;
  setCursor: (x: number, y: number) => void;
}

export const usePetMoodStore = create<PetMoodState>((set) => ({
  mood: 'idle',
  cursor: { x: 0, y: 0 },
  setMood: (mood) => set({ mood }),
  setCursor: (x, y) => set({ cursor: { x, y } }),
}));