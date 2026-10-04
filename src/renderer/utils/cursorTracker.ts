import { clampUnit } from './math';

/** Posicion normalizada respecto al centro de la ventana, en el rango -1..1. */
export interface CursorPosition {
  x: number;
  y: number;
}

/** Tamano de la ventana, usado para normalizar. */
export interface ViewportSize {
  width: number;
  height: number;
}

/** Peticion de un frame. En el renderer es `requestAnimationFrame`. */
export type ScheduleFrame = (callback: () => void) => number;

/**
 * Movimiento minimo en px de pantalla para gastar un frame (R-01 del PDR).
 *
 * Sin este umbral, el micromovimiento del raton dentro de un mismo pixel
 * obliga al navegador a pintar una escena identica una y otra vez.
 */
export const DEFAULT_MIN_DELTA_PX = 1;

export interface CursorTrackerOptions {
  /** Se invoca como maximo una vez por frame con la posicion normalizada. */
  onFrame: (position: CursorPosition) => void;
  /** Tamano de normalizacion. Por defecto, el de la ventana actual. */
  getViewport?: () => ViewportSize;
  /** Umbral de movimiento. Por defecto `DEFAULT_MIN_DELTA_PX`. */
  minDeltaPx?: number;
  /** Scheduler de frames. Por defecto `requestAnimationFrame`. */
  scheduleFrame?: ScheduleFrame;
  /** Cancela un frame pendiente. Por defecto `cancelAnimationFrame`. */
  cancelFrame?: (handle: number) => void;
}

export interface CursorTracker {
  /** Se engancha a `mousemove`. No debe asignarse a un frame nuevo cada vez. */
  handleMove: (event: { clientX: number; clientY: number }) => void;
  /** Vuelca la posicion pendiente sin esperar al siguiente frame. */
  flush: () => void;
  /** Cancela lo pendiente. Llamarlo siempre al desmontar. */
  destroy: () => void;
  /** `true` si queda algun frame o alguna posicion sin emitir. */
  hasPendingFrame: () => boolean;
}

function defaultViewport(): ViewportSize {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function defaultScheduleFrame(callback: () => void): number {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(() => callback());
  }
  // Respaldo para entornos sin rAF: ~60 fps.
  return setTimeout(callback, 16) as unknown as number;
}

function defaultCancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}

/**
 * Convierte coordenadas de pantalla en el cuadrado -1..1 centrado en la
 * ventana. Usa la misma convencion que `PetState.cursor` del contrato.
 */
export function normalizeCursor(
  clientX: number,
  clientY: number,
  viewport: ViewportSize,
): CursorPosition {
  // Sin medidas utilizables no hay normalizacion posible: se centra.
  if (viewport.width <= 0 || viewport.height <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: clampUnit((clientX / viewport.width) * 2 - 1),
    y: clampUnit((clientY / viewport.height) * 2 - 1),
  };
}

/** Distancia entre dos posiciones en px de pantalla. */
export function distancePx(a: CursorPosition, b: CursorPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * createCursorTracker — mitigacion de **R-01** del PDR.
 *
 * El Sprint 1 escribia en el store en *cada* evento `mousemove`, que con un
 * raton de alta frecuencia puede superar los 1000 eventos por segundo y es
 * justo lo que pone en riesgo el limite de CPU del 1 % (RNF-01).
 *
 * Aqui el evento solo deja la ultima posicion en memoria y pide **un** frame.
 * Mientras ese frame no se ejecute, las siguientes posiciones se sobrescriben
 * (coalescencia), de modo que `onFrame` se llama como maximo una vez por frame
 * y siempre con la posicion mas reciente.
 */
export function createCursorTracker(options: CursorTrackerOptions): CursorTracker {
  const {
    onFrame,
    getViewport = defaultViewport,
    minDeltaPx = DEFAULT_MIN_DELTA_PX,
    scheduleFrame = defaultScheduleFrame,
    cancelFrame = defaultCancelFrame,
  } = options;

  /** Ultima posicion recibida y aun no emitida (en px de pantalla). */
  let pending: CursorPosition | null = null;
  /** Ultima posicion emitida (en px de pantalla), base del umbral. */
  let emitted: CursorPosition | null = null;
  let frameHandle: number | null = null;
  let destroyed = false;

  const emit = (): void => {
    const target = pending;
    if (destroyed || target === null) return;
    pending = null;
    emitted = { x: target.x, y: target.y };
    onFrame(normalizeCursor(target.x, target.y, getViewport()));
  };

  const schedule = (): void => {
    if (destroyed || frameHandle !== null) return;
    frameHandle = scheduleFrame(() => {
      frameHandle = null;
      emit();
    });
  };

  return {
    handleMove(event) {
      if (destroyed) return;

      const next = { x: event.clientX, y: event.clientY };

      // Movimiento por debajo del umbral: repintar la misma escena solo gasta CPU.
      if (emitted !== null && distancePx(emitted, next) < minDeltaPx) return;

      pending = next;
      schedule();
    },

    flush() {
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
      emit();
    },

    destroy() {
      destroyed = true;
      pending = null;
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
    },

    hasPendingFrame() {
      return frameHandle !== null || pending !== null;
    },
  };
}