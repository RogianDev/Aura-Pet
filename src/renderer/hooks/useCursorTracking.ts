import { useEffect } from 'react';
import { setCursorMotion } from '../motion/cursorMotion';
import { usePetMoodStore } from '../stores/petMoodStore';
import { createCursorTracker } from '../utils/cursorTracker';

export interface UseCursorTrackingOptions {
  /** Permite desactivar el seguimiento (por ejemplo, en los tests). */
  enabled?: boolean;
  /** Movimiento minimo en px para actualizar. Por defecto, 1 px. */
  minDeltaPx?: number;
  /** Refleja ademas la posicion en `petMoodStore`. Por defecto, `true`. */
  syncStore?: boolean;
}

/**
 * useCursorTracking — RF-02 (seguimiento del cursor) y R-01 (throttling).
 *
 * El hook es deliberadamente corto: delega todo el trabajo con coalescencia en
 * `createCursorTracker` y se limita a engancharlo y desengancharlo de la
 * ventana. Toda la logica verificable vive en `utils/cursorTracker.ts`.
 *
 * Cada posicion se publica por dos vias:
 *  1. `cursorMotion`, un `MotionValue` que mueve el SVG sin re-renderizar
 *     React (es lo que sostiene TC-PET-001).
 *  2. `petMoodStore.cursor`, para que la posicion sea estado observable de la
 *     app y coincida con `PetState.cursor` del contrato.
 */
export function useCursorTracking(options: UseCursorTrackingOptions = {}): void {
  const { enabled = true, minDeltaPx, syncStore = true } = options;
  const setCursor = usePetMoodStore((s) => s.setCursor);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const tracker = createCursorTracker({
      minDeltaPx,
      onFrame: ({ x, y }) => {
        setCursorMotion(x, y);
        if (syncStore) setCursor(x, y);
      },
    });

    // `handleMove` es la misma referencia durante toda la vida del tracker,
    // asi que se puede quitar sin envoltura.
    window.addEventListener('mousemove', tracker.handleMove);

    return () => {
      window.removeEventListener('mousemove', tracker.handleMove);
      // Sin esto, un frame ya pedido escribiria en el store tras desmontar.
      tracker.destroy();
    };
  }, [enabled, minDeltaPx, syncStore, setCursor]);
}