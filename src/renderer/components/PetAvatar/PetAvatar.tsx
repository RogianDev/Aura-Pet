import { useEffect, useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';
import { usePetMoodStore } from '../../stores/petMoodStore';

/** Desplazamiento maximo de las pupilas en unidades del viewBox. */
const PUPIL_OFFSET = 6;
const IDLE_BLINK_MS = 3200;
const BLINK_DURATION_MS = 140;

/**
 * PetAvatar — RF-02 (Mascota vectorial SVG + Framer Motion)
 *
 * SVG 100% nativo (sin imagenes raster). Sigue el cursor del sistema
 * con fisicas de resorte y parpadea de forma aleatoria.
 */
export function PetAvatar() {
  const cursor = usePetMoodStore((s) => s.cursor);
  const setCursor = usePetMoodStore((s) => s.setCursor);
  const mood = usePetMoodStore((s) => s.mood);

  const [isBlinking, setIsBlinking] = useState(false);
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Seguimiento del cursor ---
  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      // Normalizamos respecto al tamano de la ventana (-1..1).
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      setCursor(x, y);
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [setCursor]);

  // --- Parpadeo aleatorio ---
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = IDLE_BLINK_MS + Math.random() * IDLE_BLINK_MS;
      blinkTimer.current = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), BLINK_DURATION_MS);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => {
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
    };
  }, []);

  // --- Fisicas de resorte ---
  const pupilX = useSpring(cursor.x * PUPIL_OFFSET, { stiffness: 260, damping: 18 });
  const pupilY = useSpring(cursor.y * PUPIL_OFFSET, { stiffness: 260, damping: 18 });

  const eyeScaleY = useSpring(isBlinking ? 0.1 : 1, { stiffness: 500, damping: 30 });
  const isSleepy = mood === 'sleepy';

  return (
    <div className="flex h-full w-full items-center justify-center drag-region">
      <motion.svg
        viewBox="0 0 120 120"
        width="180"
        height="180"
        aria-label="Mascota AuraPet"
        whileHover={{ scale: 1.03 }}
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Cuerpo */}
        <ellipse cx="60" cy="78" rx="38" ry="34" fill="#7c5cff" opacity="0.92" />
        {/* Brillo superior */}
        <ellipse cx="48" cy="62" rx="16" ry="10" fill="#ffffff" opacity="0.18" />

        {/* Ojos */}
        <motion.g style={{ scaleY: eyeScaleY, originY: 0.42 }}>
          <ellipse cx="47" cy="52" rx="9" ry="11" fill="#ffffff" />
          <ellipse cx="73" cy="52" rx="9" ry="11" fill="#ffffff" />
          <motion.g style={{ x: pupilX, y: pupilY }}>
            <circle cx="47" cy="53" r="5" fill="#1a1626" />
            <circle cx="73" cy="53" r="5" fill="#1a1626" />
          </motion.g>
        </motion.g>

        {/* Boca: cambia segun el animo */}
        {isSleepy ? (
          <path d="M54 68 q6 4 12 0" stroke="#1a1626" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        ) : mood === 'happy' ? (
          <path d="M52 66 q8 10 16 0" stroke="#1a1626" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M56 68 q4 3 8 0" stroke="#1a1626" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}

        {/* Antena indicadora de estado de conexion */}
        <circle cx="60" cy="24" r="4" fill={mood === 'alert' ? '#ff5ca8' : '#ff5ca8'} opacity={mood === 'alert' ? 1 : 0.45} />
      </motion.svg>
    </div>
  );
}