/** Ventanas de tiempo del parpadeo automatico (RF-02). */
export interface BlinkConfig {
  /** Espera minima entre parpadeos, en ms. */
  minDelayMs: number;
  /** Espera maxima entre parpadeos, en ms. */
  maxDelayMs: number;
  /** Duracion del parpadeo, en ms. */
  durationMs: number;
}

/**
 * Una persona no parpadea con un ritmo fijo: 2,2 s a 5,4 s encaja mejor con
 * el intervalo natural que un retardo fijo.
 */
export const DEFAULT_BLINK_CONFIG: BlinkConfig = {
  minDelayMs: 2200,
  maxDelayMs: 5400,
  durationMs: 140,
};

/** Fuente de azar inyectable para que los tests sean deterministas. */
export type RandomSource = () => number;

export interface BlinkSchedulerOptions {
  /** El parpadeo empieza (los parpados se cierran). */
  onBlinkStart: () => void;
  /** El parpadeo termina (los parpados se abren). */
  onBlinkEnd: () => void;
  config?: Partial<BlinkConfig>;
  random?: RandomSource;
  /** Inyecta el reloj. Por defecto `setTimeout`. */
  setTimer?: (callback: () => void, delayMs: number) => number;
  clearTimer?: (handle: number) => void;
  /** Permite congelar el parpadeo (por ejemplo, si la mascota duerme). */
  shouldBlink?: () => boolean;
}

export interface BlinkScheduler {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  /** Fuerza un parpadeo inmediato sin reiniciar la cuenta atras. */
  blinkNow: () => void;
}

/** Calcula la espera hasta el siguiente parpadeo, dentro de la ventana dada. */
export function nextBlinkDelay(
  config: Pick<BlinkConfig, 'minDelayMs' | 'maxDelayMs'>,
  random: RandomSource = Math.random,
): number {
  const min = Math.max(0, config.minDelayMs);
  const max = Math.max(min, config.maxDelayMs);
  return Math.round(min + (max - min) * random());
}

function defaultSetTimer(callback: () => void, delayMs: number): number {
  return setTimeout(callback, delayMs) as unknown as number;
}

function defaultClearTimer(handle: number): void {
  clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}

/**
 * createBlinkScheduler — parpadeo aleatorio con reloj inyectable.
 *
 * No depende de React: se puede verificar en Vitest (entorno `node`) con un
 * reloj falso y un `random` fijo, sin necesitar `jsdom`.
 *
 * La decision de parpadear se consulta en el momento de dispararse
 * (`shouldBlink`), y no al programarlo: asi, si la mascota se duerme a mitad
 * de cuenta, el proximo parpadeo se omite sin reprogramar nada.
 */
export function createBlinkScheduler(options: BlinkSchedulerOptions): BlinkScheduler {
  const {
    onBlinkStart,
    onBlinkEnd,
    random = Math.random,
    config,
    setTimer = defaultSetTimer,
    clearTimer = defaultClearTimer,
    shouldBlink = () => true,
  } = options;

  const resolved: BlinkConfig = { ...DEFAULT_BLINK_CONFIG, ...config };

  let nextHandle: number | null = null;
  let endHandle: number | null = null;
  let running = false;

  const clearPending = (): void => {
    if (nextHandle !== null) {
      clearTimer(nextHandle);
      nextHandle = null;
    }
    if (endHandle !== null) {
      clearTimer(endHandle);
      endHandle = null;
    }
  };

  const scheduleNext = (): void => {
    if (!running) return;
    nextHandle = setTimer(() => {
      nextHandle = null;
      if (!running) return;

      // Animo que no admite parpadeo: se omite y se sigue contando.
      if (!shouldBlink()) {
        scheduleNext();
        return;
      }

      onBlinkStart();
      endHandle = setTimer(() => {
        endHandle = null;
        onBlinkEnd();
      }, resolved.durationMs);

      // El proximo parpadeo se programa ya: solapar la cuenta con el cierre
      // de los parpados mantiene el ritmo cuando durationMs es pequeno.
      scheduleNext();
    }, nextBlinkDelay(resolved, random));
  };

  const openEyes = (): void => {
    endHandle = setTimer(() => {
      endHandle = null;
      onBlinkEnd();
    }, resolved.durationMs);
  };

  return {
    start() {
      if (running) return;
      running = true;
      scheduleNext();
    },

    stop() {
      running = false;
      clearPending();
    },

    isRunning: () => running,

    blinkNow() {
      // No se solapa con un parpadeo en curso: cerraria y abriria de golpe.
      if (!running || endHandle !== null) return;
      onBlinkStart();
      openEyes();
    },
  };
}