import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * SecureStore — pruebas de almacenamiento cifrado (Sprint 3, Dev A).
 *
 * En un test se sustituye `safeStorage` por un "cifrado" reversible: lo que se
 * verifica aqui es la LOGICA de la clase (validacion, cache, persistencia y
 * recuperacion), no la implementacion de DPAPI, que corresponde al SO.
 */

let dir = '';

vi.mock('electron', () => {
  // "Cifrado" simulado en base64: no es DPAPI, pero a diferencia de un simple
  // prefijo SI oculta el contenido, de modo que la asercion "no se escribe en
  // claro" sigue siendo significativa.
  return {
    app: { getPath: () => dir },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (text: string) => Buffer.from(text, 'utf8').toString('base64'),
      decryptString: (buf: Buffer) =>
        Buffer.from(buf.toString('utf8'), 'base64').toString('utf8'),
    },
  };
});

const { SecureStore } = await import('../../src/main/storage/SecureStore');

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'aurapet-'));
});

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('SecureStore', () => {
  it('guarda y recupera una credencial', () => {
    const store = new SecureStore(join(dir, 'creds.enc'));
    store.set('apiKey:openai', 'sk-test-123');

    expect(store.get('apiKey:openai')).toBe('sk-test-123');
  });

  it('NO escribe la credencial en claro en disco', () => {
    const path = join(dir, 'creds.enc');
    const store = new SecureStore(path);
    store.set('apiKey:openai', 'sk-secreto-real');

    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path).toString('utf8')).not.toContain('sk-secreto-real');
    expect(readFileSync(path).toString('utf8')).not.toContain('apiKey');
  });

  it('persiste entre instancias (recarga desde disco)', () => {
    const path = join(dir, 'creds.enc');
    new SecureStore(path).set('apiKey:anthropic', 'sk-ant');

    // Nueva instancia: no debe usar la cache anterior.
    expect(new SecureStore(path).get('apiKey:anthropic')).toBe('sk-ant');
  });

  it('isConfigured responde sin revelar el valor', () => {
    const store = new SecureStore(join(dir, 'creds.enc'));
    expect(store.isConfigured('openai')).toBe(false);
    store.set('apiKey:openai', 'sk-x');
    expect(store.isConfigured('openai')).toBe(true);
  });

  it('elimina una credencial', () => {
    const store = new SecureStore(join(dir, 'creds.enc'));
    store.set('apiKey:openai', 'sk-x');
    store.delete('apiKey:openai');

    expect(store.get('apiKey:openai')).toBeUndefined();
    expect(store.isConfigured('openai')).toBe(false);
  });

  it('crea el directorio si no existe', () => {
    const store = new SecureStore(join(dir, 'anidado', 'profundo', 'creds.enc'));
    expect(() => store.set('apiKey:openai', 'sk-x')).not.toThrow();
  });

  it('un fichero corrupto no impide arrancar (se descarta)', () => {
    const path = join(dir, 'creds.enc');
    const store = new SecureStore(path);
    store.set('apiKey:openai', 'sk-x');

    // Se corrompe el contenido a proposito.
    require('node:fs').writeFileSync(path, 'BASURA_NO_CIFRADA');

    const nueva = new SecureStore(path);
    expect(nueva.get('apiKey:openai')).toBeUndefined();
    expect(nueva.keys()).toEqual([]);
  });

  it('keys() devuelve solo los nombres, nunca los valores', () => {
    const store = new SecureStore(join(dir, 'creds.enc'));
    store.set('apiKey:openai', 'sk-secreto');

    expect(store.keys()).toEqual(['apiKey:openai']);
    expect(store.keys().join(',')).not.toContain('sk-secreto');
  });
});