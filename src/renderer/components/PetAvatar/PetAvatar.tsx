import { motion } from 'framer-motion';
import { MOOD_CONFIG } from '../../config/moodConfig';
import { useBlink } from '../../hooks/useBlink';
import { usePetPhysics } from '../../hooks/usePetPhysics';
import { usePetMoodStore } from '../../stores/petMoodStore';

/**
 * Anclaje del `scaleY` de los parpados, en fraccion de la caja del grupo de
 * ojos. Sin esto el escalado partiria del origen (0,0) del viewBox y los ojos
 * se correrian hacia arriba al cerrarse.
 */
const EYE_ORIGIN_X = 0.5;
const EYE_ORIGIN_Y = 0.45;

/**
 * PetAvatar — RF-02 (Mascota vectorial SVG + Framer Motion)
 *
 * SVG 100% nativo (sin imagenes raster). Sigue el cursor del sistema con
 * fisicas de resorte y parpadea de forma aleatoria.
 *
 * El componente ya no contiene logica reactiva: el seguimiento del cursor, el
 * parpadeo y las fisicas viven en `hooks/`, y el aspecto de cada animo en
 * `config/moodConfig.ts`. Aqui solo se dibuja.
 */
export function PetAvatar() {
  const mood = usePetMoodStore((s) => s.mood);

  // Parpadeo aleatorio; publica el resultado en petMoodStore.isBlinking.
  useBlink();

  // Resortes de pupilas y parpados, ya ajustados al animo actual.
  const { pupilX, pupilY, eyeScaleY } = usePetPhysics();

  const { label, body, gloss, mouth, antenna } = MOOD_CONFIG[mood];

  return (
    <div className="flex h-full w-full items-center justify-center drag-region">
      <motion.svg
        viewBox="0 0 120 120"
        width="180"
        height="180"
        role="img"
        aria-label={label}
        whileHover={{ scale: 1.03 }}
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Cuerpo. El color interpola al cambiar de animo. */}
        <motion.ellipse
          cx="60"
          cy="78"
          rx="38"
          ry="34"
          initial={false}
          animate={{ fill: body }}
          transition={{ duration: 0.35 }}
          opacity="0.92"
        />
        {/* Brillo superior */}
        <ellipse cx="48" cy="62" rx="16" ry="10" fill="#ffffff" opacity={gloss} />

        {/* Ojos. El grupo entero se aplasta al cerrar los parpados. */}
        <motion.g
          style={{ scaleY: eyeScaleY, originX: EYE_ORIGIN_X, originY: EYE_ORIGIN_Y }}
        >
          <ellipse cx="47" cy="52" rx="9" ry="11" fill="#ffffff" />
          <ellipse cx="73" cy="52" rx="9" ry="11" fill="#ffffff" />
          {/* Las pupilas siguen al cursor mediante los MotionValue del resorte. */}
          <motion.g style={{ x: pupilX, y: pupilY }}>
            <circle cx="47" cy="53" r="5" fill="#1a1626" />
            <circle cx="73" cy="53" r="5" fill="#1a1626" />
          </motion.g>
        </motion.g>

        {/* Boca: el trazo depende del animo (MOOD_CONFIG). */}
        <path
          d={mouth}
          stroke="#1a1626"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Antena indicadora de estado de conexion */}
        <circle cx="60" cy="24" r="4" fill={antenna.color} opacity={antenna.opacity} />
      </motion.svg>
    </div>
  );
}