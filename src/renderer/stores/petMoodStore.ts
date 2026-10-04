import { create } from 'zustand';
import type { PetMood } from '@shared/contracts';

export interface PetMoodState {
  mood: PetMood;
  /** Posicion normalizada del cursor respecto a la ventana (-1..1). */
  cursor: { x: number; y: number };
  /** `true` mientras los parpados estan cerrados por un parpadeo. */
  isBlinking: boolean;
  setMood: (mood: PetMood) => void;
  setCursor: (x: number, y: number) => void;
  setBlinking: (isBlinking: boolean) => void;
  /** Vuelve al estado inicial (se usa al desmontar la app o en tests). */
  reset: () => void;
}

/**
 * Estado inicial de la mascota.
 *
 * `cursor` es un objeto propio (nunca compartido) para que ningun consumidor
 * pueda mutar el estado del store por referencia.
 */
export function createInitialPetMoodState(): Pick<
  PetMoodState,
  'mood' | 'cursor' | 'isBlinking'
> {
  return {
    mood: 'idle',
    cursor: { x: 0, y: 0 },
    isBlinking: false,
  };
}

export const usePetMoodStore = create<PetMoodState>((set) => ({
  ...createInitialPetMoodState(),

  // Los setters que reciben el mismo valor devuelven el estado intacto:
  // Zustand no notifica a los suscriptores y se evita un re-render inútil.
  setMood: (mood) =>
    set((state) => (state.mood === mood ? state : { mood })),

  setCursor: (x, y) => set({ cursor: { x, y } }),

  setBlinking: (isBlinking) =>
    set((state) => (state.isBlinking === isBlinking ? state : { isBlinking })),

  reset: () => set(createInitialPetMoodState()),
}));

/* ------------------------------------------------------------------ *
 * Selectores derivados.
 *
 * Suscribirse a un booleano derivado es mas barato que a `mood`: solo
 * re-renderiza el componente cuando ese booleano cambia de verdad.
 * ------------------------------------------------------------------ */

/** La mascota esta dormida: no parpadea y respira despacio. */
export const selectIsSleepy = (state: PetMoodState): boolean => state.mood === 'sleepy';

/** La esta avisando una alerta (evento de CLI o similar). */
export const selectIsAlert = (state: PetMoodState): boolean => state.mood === 'alert';

/** La mascota esta en un animo que admite parpadeo. */
export const selectCanBlink = (state: PetMoodState): boolean => state.mood !== 'sleepy';