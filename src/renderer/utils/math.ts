/**
 * Utilidades numericas puras del renderer.
 *
 * Sin dependencias de React ni de Zustand: asi pueden verificarse aisladas
 * con Vitest en entorno `node` (matriz de calidad, seccion 5 del PDR).
 */

/**
 * Acota `value` al intervalo [min, max].
 * Los valores no numericos (NaN) y los intervalos invertidos devuelven `min`.
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/** Acota `value` al intervalo unitario [-1, 1]. */
export function clampUnit(value: number): number {
  return clamp(value, -1, 1);
}