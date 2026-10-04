import { describe, it, expect } from 'vitest';
import { CLI_EVENT_MAX_BYTES } from '../../src/shared/contracts';
import { parseCliEvent, moodForEvent } from '../../src/main/sockets/events';

/**
 * Validacion de eventos de CLI (diseno aprobado del Sprint 2 Dev A).
 * Regla critica: un mensaje invalido NUNCA debe lanzar excepcion.
 */
describe('parseCliEvent', () => {
  const validStarted = JSON.stringify({
    type: 'cli.command.started',
    data: { command: 'npm test' },
  });

  it('acepta un evento cli.command.started valido', () => {
    const result = parseCliEvent(validStarted);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.type).toBe('cli.command.started');
      expect(result.event.data).toMatchObject({ command: 'npm test' });
    }
  });

  it('completa el timestamp si no viene', () => {
    const result = parseCliEvent(validStarted);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.timestamp).toBeTruthy();
  });

  it('acepta un evento cli.command.finished valido', () => {
    const result = parseCliEvent(
      JSON.stringify({ type: 'cli.command.finished', data: { command: 'npm test', exitCode: 0 } }),
    );
    expect(result.ok).toBe(true);
  });

  it('acepta Buffer ademas de string', () => {
    const result = parseCliEvent(Buffer.from(validStarted, 'utf8'));
    expect(result.ok).toBe(true);
  });

  // --- Casos que deben ser rechazados sin lanzar excepcion ---
  it.each([
    ['json invalido', 'no-es-json'],
    ['array en vez de objeto', '[1,2,3]'],
    ['tipo desconocido', JSON.stringify({ type: 'hack.everything', data: {} })],
    ['type ausente', JSON.stringify({ data: { command: 'x' } })],
    ['data no es objeto', JSON.stringify({ type: 'cli.command.started', data: 'x' })],
    ['command vacio', JSON.stringify({ type: 'cli.command.started', data: { command: '' } })],
    ['command no string', JSON.stringify({ type: 'cli.command.started', data: { command: 42 } })],
    ['exitCode no numerico', JSON.stringify({ type: 'cli.command.finished', data: { command: 'x', exitCode: '0' } })],
    ['timestamp no string', JSON.stringify({ type: 'cli.command.started', data: { command: 'x' }, timestamp: 5 })],
  ])('rechaza %s', (_nombre, entrada) => {
    const result = parseCliEvent(entrada);
    expect(result.ok).toBe(false);
  });

  it('rechaza un payload mayor de 64 KB', () => {
    const gigante = JSON.stringify({
      type: 'cli.command.started',
      data: { command: 'x'.repeat(CLI_EVENT_MAX_BYTES + 10) },
    });
    const result = parseCliEvent(gigante);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/grande/i);
  });
});

describe('moodForEvent', () => {
  it('cli.command.started produce curious', () => {
    const result = parseCliEvent(JSON.stringify({ type: 'cli.command.started', data: { command: 'x' } }));
    if (result.ok) expect(moodForEvent(result.event)).toBe('curious');
  });

  it('exitCode 0 produce happy', () => {
    const result = parseCliEvent(
      JSON.stringify({ type: 'cli.command.finished', data: { command: 'x', exitCode: 0 } }),
    );
    if (result.ok) expect(moodForEvent(result.event)).toBe('happy');
  });

  it('exitCode distinto de 0 produce alert (reaccion marcada, opcion B)', () => {
    const result = parseCliEvent(
      JSON.stringify({ type: 'cli.command.finished', data: { command: 'x', exitCode: 1 } }),
    );
    if (result.ok) expect(moodForEvent(result.event)).toBe('alert');
  });
});