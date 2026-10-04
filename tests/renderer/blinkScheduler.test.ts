import { describe, expect, it } from 'vitest';
import {
  createBlinkScheduler,
  DEFAULT_BLINK_CONFIG,
  nextBlinkDelay,
  type BlinkSchedulerOptions,
} from '../../src/renderer/utils/blinkScheduler';

/**
 * Reloj falso: los timers no se ejecutan solos, el test decide cuando.
 * `fireNext()` dispara solo el mas proximo, igual que haria un reloj real, de
 * modo que se puede comprobar el orden real de los eventos y no solo el estado
 * final. A igualdad de retardo gana el primero programado.
 */
function createFakeTimers() {
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let nextId = 1;

  return {
    setTimer(callback: () => void, delay: number): number {
      const id = nextId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimer(handle: number): void {
      timers.delete(handle);
    },
    count(): number {
      return timers.size;
    },
    delays(): number[] {
      return [...timers.values()].map((timer) => timer.delay);
    },
    fireNext(): boolean {
      let targetId: number | null = null;
      let targetDelay = Infinity;

      for (const [id, timer] of timers) {
        if (timer.delay < targetDelay) {
          targetDelay = timer.delay;
          targetId = id;
        }
      }

      if (targetId === null) return false;

      const timer = timers.get(targetId);
      timers.delete(targetId);
      timer?.callback();
      return true;
    },
  };
}

describe('nextBlinkDelay', () => {
  const WINDOW = { minDelayMs: 1000, maxDelayMs: 3000 };

  it('devuelve el minimo cuando el azar es 0', () => {
    expect(nextBlinkDelay(WINDOW, () => 0)).toBe(1000);
  });

  it('devuelve el maximo cuando el azar es 1', () => {
    expect(nextBlinkDelay(WINDOW, () => 1)).toBe(3000);
  });

  it('nunca sale de la ventana configurada', () => {
    for (const random of [0, 0.25, 0.5, 0.75, 0.999]) {
      const delay = nextBlinkDelay(DEFAULT_BLINK_CONFIG, () => random);
      expect(delay).toBeGreaterThanOrEqual(DEFAULT_BLINK_CONFIG.minDelayMs);
      expect(delay).toBeLessThanOrEqual(DEFAULT_BLINK_CONFIG.maxDelayMs);
    }
  });

  it('tolera una ventana invertida', () => {
    expect(nextBlinkDelay({ minDelayMs: 5000, maxDelayMs: 1000 }, () => 0)).toBe(5000);
  });
});

describe('createBlinkScheduler', () => {
  function setup(options: Partial<BlinkSchedulerOptions> = {}) {
    const clock = createFakeTimers();
    const events: string[] = [];
    const scheduler = createBlinkScheduler({
      onBlinkStart: () => events.push('cierra'),
      onBlinkEnd: () => events.push('abre'),
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      // Azar fijo: el parpadeo sale siempre en el minimo de la ventana, lo
      // que hace los retardos comparables y los tests deterministas.
      random: () => 0,
      ...options,
    });

    return { clock, events, scheduler };
  }

  it('no hace nada hasta que se arranca', () => {
    const { clock, events, scheduler } = setup();

    clock.fireNext();

    expect(events).toEqual([]);
    expect(scheduler.isRunning()).toBe(false);
  });

  it('al arrancar programa exactamente un parpadeo', () => {
    const { clock, scheduler } = setup();

    scheduler.start();

    expect(scheduler.isRunning()).toBe(true);
    expect(clock.count()).toBe(1);

    scheduler.stop();
  });

  it('cerrar y abrir los ojos ocurre en ese orden', () => {
    const { clock, events, scheduler } = setup();
    scheduler.start();

    // 1. Se cumple la espera: el parpadeo empieza y se programa su cierre.
    clock.fireNext();
    expect(events).toEqual(['cierra']);

    // 2. Se cumple la duracion: los ojos vuelven a abrirse.
    clock.fireNext();
    expect(events).toEqual(['cierra', 'abre']);

    scheduler.stop();
  });

  it('mantiene el ritmo indefinidamente', () => {
    const { clock, events, scheduler } = setup();
    scheduler.start();

    clock.fireNext(); // cierra
    clock.fireNext(); // abre
    clock.fireNext(); // cierra otra vez

    expect(events).toEqual(['cierra', 'abre', 'cierra']);

    scheduler.stop();
  });

  it('usa la duracion configurada para el cierre de los ojos', () => {
    const { clock, scheduler } = setup({ config: { durationMs: 75 } });
    scheduler.start();

    clock.fireNext();

    expect(clock.delays()).toContain(75);

    scheduler.stop();
  });

  it('omite el parpadeo cuando shouldBlink devuelve false', () => {
    const { clock, events, scheduler } = setup({ shouldBlink: () => false });
    scheduler.start();

    clock.fireNext();

    expect(events).toEqual([]);
    // Aun asi queda reprogramado para probar mas adelante.
    expect(clock.count()).toBe(1);

    scheduler.stop();
  });

  it('reacciona a un shouldBlink que cambia con el tiempo', () => {
    let puedeParpadear = false;
    const { clock, events, scheduler } = setup({ shouldBlink: () => puedeParpadear });
    scheduler.start();

    clock.fireNext();
    expect(events).toEqual([]);

    puedeParpadear = true;
    clock.fireNext();
    expect(events).toEqual(['cierra']);

    scheduler.stop();
  });

  it('stop cancela los timers pendientes', () => {
    const { clock, events, scheduler } = setup();
    scheduler.start();
    scheduler.stop();

    clock.fireNext();

    expect(events).toEqual([]);
    expect(scheduler.isRunning()).toBe(false);
  });

  it('arrancar dos veces no duplica la programacion', () => {
    const { clock, scheduler } = setup();

    scheduler.start();
    scheduler.start();

    expect(clock.count()).toBe(1);

    scheduler.stop();
  });

  it('blinkNow fuerza un parpadeo inmediato', () => {
    const { clock, events, scheduler } = setup();
    scheduler.start();

    scheduler.blinkNow();

    expect(events).toEqual(['cierra']);

    clock.fireNext();
    expect(events).toEqual(['cierra', 'abre']);

    scheduler.stop();
  });

  it('blinkNow no se solapa con un parpadeo en curso', () => {
    const { events, scheduler } = setup();
    scheduler.start();

    scheduler.blinkNow();
    scheduler.blinkNow();

    expect(events).toEqual(['cierra']);

    scheduler.stop();
  });

  it('blinkNow no hace nada si el planificador esta parado', () => {
    const { events, scheduler } = setup();

    scheduler.blinkNow();

    expect(events).toEqual([]);
  });
});