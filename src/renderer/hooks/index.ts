/**
 * Barrel de los hooks del renderer (PDR, seccion 4.2: `renderer/hooks/`).
 *
 * Se exportan los hooks, no la logica interna: `utils/cursorTracker.ts` y
 * `utils/blinkScheduler.ts` se importan directamente desde los tests.
 */

export { useBlink } from './useBlink';
export type { UseBlinkOptions } from './useBlink';

export { useCursorTracking } from './useCursorTracking';
export type { UseCursorTrackingOptions } from './useCursorTracking';

export { usePetPhysics } from './usePetPhysics';
export type { PetPhysics } from './usePetPhysics';