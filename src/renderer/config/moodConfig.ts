import type { PetMood } from '@shared/contracts';

/** Recorrido maximo de la pupila en unidades del viewBox, con `pupilTravel` 1. */
export const PUPIL_TRAVEL = 3;

/** Escala vertical de los parpados con los ojos cerrados (0 = cerrado, 1 = abierto). */
export const EYES_CLOSED_SCALE = 0.08;

/** Constantes del resorte de las pupilas, propias de cada animo. */
export interface MoodPhysics {
  /** Rigidez: mayor = la pupila llega antes al objetivo. */
  stiffness: number;
  /** Amortiguacion: mayor = menos oscilacion al frenar. */
  damping: number;
  /** Multiplicador del recorrido de la pupula segun el animo. */
  pupilTravel: number;
  /** Duracion en segundos del balanceo vertical del cuerpo. */
  bobDuration: number;
}

/** Todo lo que un animo cambia de la mascota, en un solo sitio. */
export interface MoodConfig {
  /** Etiqueta accesible del estado. */
  label: string;
  /** Color principal del cuerpo. */
  body: string;
  /** Opacidad del brillo superior. */
  gloss: number;
  /** Trazo SVG de la boca. */
  mouth: string;
  /** Los ojos se mantienen cerrados mientras dure este animo. */
  eyesClosed: boolean;
  /** Color y opacidad de la antena de estado. */
  antenna: { color: string; opacity: number };
  physics: MoodPhysics;
}

/**
 * Configuracion visual y fisica por animo (RF-02).
 *
 * Vive fuera del componente y del store para que tanto `PetAvatar` como
 * `usePetPhysics` lean la misma fuente y no puedan desincronizarse.
 */
export const MOOD_CONFIG: Record<PetMood, MoodConfig> = {
  idle: {
    label: 'Mascota AuraPet en reposo',
    body: '#7c5cff',
    gloss: 0.18,
    mouth: 'M56 68 q4 3 8 0',
    eyesClosed: false,
    antenna: { color: '#ff5ca8', opacity: 0.45 },
    physics: { stiffness: 150, damping: 24, pupilTravel: 1, bobDuration: 3 },
  },
  happy: {
    label: 'Mascota AuraPet feliz',
    body: '#ffc857',
    gloss: 0.26,
    mouth: 'M52 66 q8 10 16 0',
    eyesClosed: false,
    antenna: { color: '#ff5ca8', opacity: 1 },
    physics: { stiffness: 190, damping: 26, pupilTravel: 1.15, bobDuration: 1.1 },
  },
  curious: {
    label: 'Mascota AuraPet curiosa',
    body: '#6ee7d5',
    gloss: 0.22,
    mouth: 'M58 64 a3 3 0 1 0 0 6 a3 3 0 1 0 0 -6',
    eyesClosed: false,
    antenna: { color: '#7ef9e1', opacity: 0.9 },
    physics: { stiffness: 220, damping: 28, pupilTravel: 1.35, bobDuration: 1.8 },
  },
  sleepy: {
    label: 'Mascota AuraPet dormida',
    body: '#4c5b8a',
    gloss: 0.1,
    mouth: 'M54 68 q6 4 12 0',
    eyesClosed: true,
    antenna: { color: '#8fa3c8', opacity: 0.35 },
    physics: { stiffness: 90, damping: 28, pupilTravel: 0.6, bobDuration: 4.2 },
  },
  alert: {
    label: 'Mascota AuraPet avisando de una alerta',
    body: '#ff5ca8',
    gloss: 0.3,
    mouth: 'M57 65 h6 q1.5 0 1.5 1.5 v2 q0 1.5 -1.5 1.5 h-6 q-1.5 0 -1.5 -1.5 v-2 q0 -1.5 1.5 -1.5 z',
    eyesClosed: false,
    antenna: { color: '#ff3b6b', opacity: 1 },
    physics: { stiffness: 300, damping: 32, pupilTravel: 1.2, bobDuration: 0.55 },
  },
};