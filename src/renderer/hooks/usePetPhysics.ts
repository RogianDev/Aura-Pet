import { useSpring, useTransform, type MotionValue } from 'framer-motion';
import { EYES_CLOSED_SCALE, MOOD_CONFIG, PUPIL_TRAVEL } from '../config/moodConfig';
import { cursorXMotion, cursorYMotion } from '../motion/cursorMotion';
import { usePetMoodStore } from '../stores/petMoodStore';

export interface PetPhysics {
  /** Desplazamiento horizontal de las pupilas, en unidades del viewBox. */
  pupilX: MotionValue<number>;
  /** Desplazamiento vertical de las pupilas, en unidades del viewBox. */
  pupilY: MotionValue<number>;
  /** Escala vertical de los parpados: 1 abiertos, ~0 cerrados. */
  eyeScaleY: MotionValue<number>;
}

/**
 * usePetPhysics — fisicas de resorte de la mascota (RF-02).
 *
 * Concentra aqui los tres movimientos que el SVG consume. El componente queda
 * con HTML plano y no vuelve a crear resortes a mano.
 *
 * `useSpring` recibe el `MotionValue` del cursor como origen, de modo que el
 * movimiento del raton no pasa por el estado de React: es lo que permite
 * sostener 60 fps sin re-renderizar el arbol por cada evento.
 */
export function usePetPhysics(): PetPhysics {
  const mood = usePetMoodStore((s) => s.mood);
  const isBlinking = usePetMoodStore((s) => s.isBlinking);

  const { physics, eyesClosed } = MOOD_CONFIG[mood];
  const { stiffness, damping, pupilTravel } = physics;

  const pupilX = useSpring(cursorXMotion, { stiffness, damping });
  const pupilY = useSpring(cursorYMotion, { stiffness, damping });

  // El animo `sleepy` mantiene los ojos cerrados; `isBlinking` los cierra un
  // instante. Los dos casos se resolvemos en un unico resorte.
  const eyeScaleY = useSpring(isBlinking || eyesClosed ? EYES_CLOSED_SCALE : 1, {
    stiffness: 520,
    damping: 32,
  });

  // La posicion normalizada (-1..1) se convierte a unidades del viewBox.
  const travel = PUPIL_TRAVEL * pupilTravel;

  return {
    pupilX: useTransform(pupilX, [-1, 1], [-travel, travel]),
    pupilY: useTransform(pupilY, [-1, 1], [-travel, travel]),
    eyeScaleY,
  };
}