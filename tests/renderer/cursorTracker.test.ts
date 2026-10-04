import { describe, expect, it } from 'vitest';
import {
  createCursorTracker,
  distancePx,
  normalizeCursor,
  type CursorPosition,
  type CursorTrackerOptions,
} from '../../src/renderer/utils/cursorTracker';

/** Ventana de prueba: 400 x 300 px. */
const VIEWPORT = { width: 400, height: 300 };

/**
 * Reloj de frames controlado por el test.
 * Nada se emite hasta que se llama a `runFrames()`, lo que permite observar
 * cuantos frames se piden de verdad y no solo cuantos hay al final.
 */
function createManualClock() {
  const pending = new Map<number, () => void>();
  let nextId = 1;

  return {
    scheduleFrame(callback: () => void): number {
      const id = nextId++;
      pending.set(id, callback);
      return id;
    },
    cancelFrame(handle: number): void {
      pending.delete(handle);
    },
    /** Ejecuta los frames pendientes. Devuelve cuantos se ejecutaron. */
    runFrames(): number {
      const entries = [...pending.entries()];
      pending.clear();
      for (const [, callback] of entries) callback();
      return entries.length;
    },
    get pendingCount(): number {
      return pending.size;
    },
  };
}

describe('normalizeCursor', () => {
  it('devuelve el origen en el centro de la ventana', () => {
    expect(normalizeCursor(200, 150, VIEWPORT)).toEqual({ x: 0, y: 0 });
  });

  it('devuelve -1,-1 en la esquina superior izquierda', () => {
    expect(normalizeCursor(0, 0, VIEWPORT)).toEqual({ x: -1, y: -1 });
  });

  it('devuelve 1,1 en la esquina inferior derecha', () => {
    expect(normalizeCursor(400, 300, VIEWPORT)).toEqual({ x: 1, y: 1 });
  });

  it('acota las coordenadas que se salen de la ventana', () => {
    expect(normalizeCursor(900, -50, VIEWPORT)).toEqual({ x: 1, y: -1 });
  });

  it('centra si la ventana no tiene medidas utilizables', () => {
    expect(normalizeCursor(10, 10, { width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('distancePx', () => {
  it('mide la distancia euclidea entre dos posiciones', () => {
    expect(distancePx({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('createCursorTracker', () => {
  function setup(options: Partial<CursorTrackerOptions> = {}) {
    const clock = createManualClock();
    const frames: CursorPosition[] = [];
    const tracker = createCursorTracker({
      onFrame: (position) => frames.push(position),
      getViewport: () => VIEWPORT,
      scheduleFrame: clock.scheduleFrame,
      cancelFrame: clock.cancelFrame,
      ...options,
    });

    return { clock, frames, tracker };
  }

  // Este es el comportamiento que mitiga R-01 del PDR.
  it('emite una sola vez por frame aunque lleguen muchos eventos', () => {
    const { clock, frames, tracker } = setup();

    tracker.handleMove({ clientX: 100, clientY: 100 });
    tracker.handleMove({ clientX: 120, clientY: 110 });
    tracker.handleMove({ clientX: 130, clientY: 120 });

    expect(frames).toHaveLength(0);
    expect(clock.runFrames()).toBe(1);

    // Ademas se descarta lo intermedio: se emite la ultima posicion.
    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual(normalizeCursor(130, 120, VIEWPORT));
  });

  it('ignora movimientos por debajo del umbral minimo', () => {
    const { clock, frames, tracker } = setup();

    tracker.handleMove({ clientX: 100, clientY: 100 });
    clock.runFrames();
    expect(frames).toHaveLength(1);

    // Menos de 1 px: no merece un repintado.
    tracker.handleMove({ clientX: 100.4, clientY: 100.3 });

    expect(clock.pendingCount).toBe(0);
    expect(frames).toHaveLength(1);
  });

  it('respeta un umbral mayor que el de por defecto', () => {
    const { clock, tracker } = setup({ minDeltaPx: 50 });

    tracker.handleMove({ clientX: 0, clientY: 0 });
    clock.runFrames();

    tracker.handleMove({ clientX: 20, clientY: 0 });
    expect(clock.pendingCount).toBe(0);

    tracker.handleMove({ clientX: 60, clientY: 0 });
    expect(clock.pendingCount).toBe(1);
  });

  it('descarta el frame pendiente al destruirse', () => {
    const { clock, frames, tracker } = setup();

    tracker.handleMove({ clientX: 100, clientY: 100 });
    tracker.destroy();
    clock.runFrames();

    expect(frames).toHaveLength(0);
  });

  it('ignora los eventos que llegan despues de destruirse', () => {
    const { clock, frames, tracker } = setup();

    tracker.destroy();
    tracker.handleMove({ clientX: 100, clientY: 100 });
    clock.runFrames();

    expect(frames).toHaveLength(0);
  });

  it('flush emite la posicion pendiente sin esperar al frame', () => {
    const { clock, frames, tracker } = setup();

    tracker.handleMove({ clientX: 200, clientY: 150 });
    tracker.flush();

    expect(frames).toEqual([{ x: 0, y: 0 }]);
    // El frame ya emitido no debe quedar pendiente.
    expect(clock.pendingCount).toBe(0);
  });

  it('flush no emite nada si no hay posicion pendiente', () => {
    const { frames, tracker } = setup();

    tracker.flush();

    expect(frames).toHaveLength(0);
  });

  it('hasPendingFrame refleja el estado interno', () => {
    const { clock, tracker } = setup();
    expect(tracker.hasPendingFrame()).toBe(false);

    tracker.handleMove({ clientX: 100, clientY: 100 });
    expect(tracker.hasPendingFrame()).toBe(true);

    clock.runFrames();
    expect(tracker.hasPendingFrame()).toBe(false);
  });

  it('usa el tamano de ventana que se le pase en cada frame', () => {
    const { frames, tracker } = setup({
      getViewport: () => ({ width: 100, height: 100 }),
    });

    tracker.handleMove({ clientX: 50, clientY: 25 });
    tracker.flush();

    expect(frames[0]).toEqual({ x: 0, y: -0.5 });
  });
});