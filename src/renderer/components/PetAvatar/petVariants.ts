import type { Easing, TargetAndTransition, Transition, Variants } from 'framer-motion';
import type { PetMood } from '@shared/contracts';
import { MOOD_CONFIG } from '../../config/moodConfig';

/**
 * Transicion del balanceo de un animo.
 *
 * La duracion sale de `MOOD_CONFIG[mood].physics.bobDuration`, de modo que el
 * ritmo de la mascota se define en un unico sitio y no se duplica aqui.
 *
 * Se declara a nivel de variante y no desglosada por propiedad a proposito:
 * en framer-motion 11 el tipo `Variants` trata cada clave como una etiqueta de
 * variante, asi que un `transition: { y: {...}, rotate: {...} }` no compila.
 *
 * El tipo de retorno se deja inferido a proposito: `Transition` es un interfaz,
 * y las interfaces no tienen indice implicito, por lo que anotarla aqui
 * impediria asignarla a `Variant`. Un literal de objeto si lo tiene.
 */
function bob(mood: PetMood, ease: Easing = 'easeInOut') {
  return {
    duration: MOOD_CONFIG[mood].physics.bobDuration,
    repeat: Infinity,
    ease,
  };
}

/**
 * Variantes de movimiento del cuerpo segun el animo (RF-02).
 *
 * Cada animo se lee como una postura fisica distinta, no solo como un color:
 * - idle: respiracion suave y un balanceo minimo (3 s).
 * - happy: rebote amplio con un segundo pico, como un salto de perro (1,1 s).
 * - curious: inclinacion lateral, la cabeza ladeada al preguntar (1,8 s).
 * - sleepy: respiracion profunda y lenta, casi sin movimiento (4,2 s).
 * - alert: pulsos cortos y rapidos, propios de una alerta de CLI (0,55 s).
 */
export const petVariants: Record<PetMood, Variants> = {
  idle: {
    animate: { y: [0, -3, 0], rotate: [0, 0.6, 0] },
    transition: bob('idle'),
  },

  happy: {
    animate: { y: [0, -10, 0, -4, 0], scale: [1, 1.04, 1] },
    transition: bob('happy', 'easeOut'),
  },

  curious: {
    animate: { y: [0, -6, 0], rotate: [-4, 4, -4], x: [0, 2, 0] },
    transition: bob('curious'),
  },

  sleepy: {
    animate: { y: [0, 2, 0], scale: [1, 1.02, 1] },
    transition: bob('sleepy'),
  },

  alert: {
    animate: { y: [0, -8, 0], scale: [1, 1.06, 1] },
    transition: bob('alert', 'easeOut'),
  },
};

/**
 * Latido de la antena mientras la mascota esta avisando (por ejemplo, cuando
 * llega un evento del servidor WebSocket, TC-SOC-001).
 */
export const antennaAlertPulse: TargetAndTransition = {
  opacity: [1, 0.25, 1],
  transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' },
};

/** Transicion usada cuando la antena vuelve a su estado de reposo. */
export const antennaRestTransition: Transition = { duration: 0.3 };