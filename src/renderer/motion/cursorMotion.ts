import { motionValue, type MotionValue } from 'framer-motion';

/**
 * Valores de movimiento del cursor, compartidos por todo el renderer.
 *
 * Son `MotionValue` y no estado de React a proposito: al escribirlos, el SVG
 * se mueve por el hilo de render de Framer Motion **sin re-renderizar** el
 * componente. Ese es el motivo de que el seguimiento del raton no dependa del
 * store de Zustand (TC-PET-001 y R-01 del PDR).
 *
 * El store se sigue alimentando en paralelo (`petMoodStore.cursor`) para que
 * la posicion quede disponible como estado observable de la app.
 */

/** Posicion horizontal normalizada respecto al centro de la ventana (-1..1). */
export const cursorXMotion: MotionValue<number> = motionValue(0);

/** Posicion vertical normalizada respecto al centro de la ventana (-1..1). */
export const cursorYMotion: MotionValue<number> = motionValue(0);

/** Publica una posicion normalizada en los valores de movimiento. */
export function setCursorMotion(x: number, y: number): void {
  cursorXMotion.set(x);
  cursorYMotion.set(y);
}

/** Devuelve el cursor al centro de la ventana. */
export function resetCursorMotion(): void {
  cursorXMotion.set(0);
  cursorYMotion.set(0);
}