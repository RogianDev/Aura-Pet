import { useEffect } from 'react';
import { usePetMoodStore } from '../stores/petMoodStore';
import { createBlinkScheduler, DEFAULT_BLINK_CONFIG } from '../utils/blinkScheduler';

export interface UseBlinkOptions {
  /** Permite desactivar el parpadeo (por ejemplo, en los tests). */
  enabled?: boolean;
  minDelayMs?: number;
  maxDelayMs?: number;
  durationMs?: number;
}

/**
 * useBlink — RF-02 (parpadeo aleatorio).
 *
 * Envuelve `createBlinkScheduler` y publica el resultado en
 * `petMoodStore.isBlinking`, de forma que cualquier componente pueda saber si
 * la mascota esta parpadeando sin conocer los timers.
 *
 * El animo se consulta en el momento del parpadeo (`getState()`) y no como
 * dependencia del efecto: asi, con la mascota dormida no se reinicia la cuenta
 * atras, simplemente se omite el parpadeo.
 */
export function useBlink(options: UseBlinkOptions = {}): void {
  const { enabled = true, minDelayMs, maxDelayMs, durationMs } = options;
  const setBlinking = usePetMoodStore((s) => s.setBlinking);

  useEffect(() => {
    if (!enabled) return;

    const scheduler = createBlinkScheduler({
      config: {
        minDelayMs: minDelayMs ?? DEFAULT_BLINK_CONFIG.minDelayMs,
        maxDelayMs: maxDelayMs ?? DEFAULT_BLINK_CONFIG.maxDelayMs,
        durationMs: durationMs ?? DEFAULT_BLINK_CONFIG.durationMs,
      },
      onBlinkStart: () => setBlinking(true),
      onBlinkEnd: () => setBlinking(false),
      shouldBlink: () => usePetMoodStore.getState().mood !== 'sleepy',
    });

    scheduler.start();

    return () => {
      scheduler.stop();
      // Un parpadeo a medias no debe dejar los ojos cerrados al desmontar.
      setBlinking(false);
    };
  }, [enabled, minDelayMs, maxDelayMs, durationMs, setBlinking]);
}