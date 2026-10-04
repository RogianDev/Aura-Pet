import {
  CLI_EVENT_MAX_BYTES,
  CLI_EVENT_TYPES,
  type CliEvent,
  type CliEventType,
} from '../../shared/contracts';

/**
 * events.ts — Validacion de eventos de CLI (RF-05).
 *
 * Un mensaje malformado NUNCA debe tumbar el servidor: se descarta y se registra.
 * Aqui no hay ninguna logica de UI (seccion 4.1 del PDR).
 */

export type ValidationResult =
  | { ok: true; event: CliEvent }
  | { ok: false; reason: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valida un mensaje WebSocket crudo y devuelve un evento tipado.
 * @param raw Mensaje recibido como string o Buffer.
 */
export function parseCliEvent(raw: string | Buffer): ValidationResult {
  const text = typeof raw === 'string' ? raw : raw.toString('utf8');

  // 1. Limite de tamano: evita agotar memoria con un payload enorme.
  if (Buffer.byteLength(text, 'utf8') > CLI_EVENT_MAX_BYTES) {
    return { ok: false, reason: `Mensaje demasiado grande (max ${CLI_EVENT_MAX_BYTES} bytes)` };
  }

  // 2. Parseo: cualquier error se captura aqui, nunca debe propagarse.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'JSON invalido' };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, reason: 'El envelope debe ser un objeto' };
  }

  // 3. Lista blanca de tipos: descarta eventos desconocidos o inventados.
  const { type, data, timestamp } = parsed as {
    type?: unknown;
    data?: unknown;
    timestamp?: unknown;
  };

  if (typeof type !== 'string' || !CLI_EVENT_TYPES.includes(type as CliEventType)) {
    return { ok: false, reason: `type desconocido: ${String(type)}` };
  }

  if (!isPlainObject(data)) {
    return { ok: false, reason: 'data debe ser un objeto' };
  }

  // 4. Validacion del payload segun el tipo concreto.
  if (typeof data['command'] !== 'string' || data['command'].length === 0) {
    return { ok: false, reason: 'data.command debe ser un string no vacio' };
  }

  if (type === 'cli.command.finished' && typeof data['exitCode'] !== 'number') {
    return { ok: false, reason: 'data.exitCode debe ser un numero' };
  }

  if (timestamp !== undefined && typeof timestamp !== 'string') {
    return { ok: false, reason: 'timestamp debe ser un string ISO 8601' };
  }

  // Tras validar, TypeScript ya conoce la forma del payload por el discriminante.
  const stamp = typeof timestamp === 'string' ? timestamp : new Date().toISOString();

  const validated: CliEvent =
    type === 'cli.command.started'
      ? { type, timestamp: stamp, data: { command: data['command'] } }
      : {
          type: 'cli.command.finished',
          timestamp: stamp,
          data: { command: data['command'], exitCode: data['exitCode'] as number },
        };

  return { ok: true, event: validated };
}

/** Traduce un evento de CLI al animo que debe mostrar la mascota. */
export function moodForEvent(event: CliEvent): 'idle' | 'happy' | 'curious' | 'alert' {
  switch (event.type) {
    case 'cli.command.started':
      return 'curious';
    case 'cli.command.finished': {
      const { exitCode } = event.data as { exitCode: number };
      // Diseno aprobado: un fallo produce una reaccion marcada (opcion B).
      return exitCode === 0 ? 'happy' : 'alert';
    }
    default:
      return 'idle';
  }
}