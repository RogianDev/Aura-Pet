import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Adaptadores de IA (Sprint 3, Dev A).
 *
 * Se levanta un servidor HTTP real que emite SSE, de modo que se verifica el
 * parsing del streaming de verdad y no contra una simulacion.
 */

let dir = '';

vi.mock('electron', () => ({
  app: { getPath: () => dir },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (t: string) => Buffer.from(`E:${t}`, 'utf8'),
    decryptString: (b: Buffer) => b.toString('utf8').slice(2),
  },
}));

const { SecureStore } = await import('../../src/main/storage/SecureStore');
const { OpenAIAdapter } = await import('../../src/main/ai-providers/OpenAIAdapter');
const { AnthropicAdapter } = await import('../../src/main/ai-providers/AnthropicAdapter');
const { createProvider, registerProvider, availableProviders, isProviderConfigured, AIProviderError } =
  await import('../../src/main/ai-providers');
const { AIProvider } = await import('../../src/main/ai-providers/AIProvider');

// --- Servidor SSE de prueba ---
type Route = { status?: number; sse: string[] };
let currentRoute: Route = { sse: [] };
let lastHeaders: Record<string, string> = {};
let lastBody = '';
let serverUrl = '';

async function startServer(): Promise<void> {
  const { createServer } = await import('node:http');
  const srv = createServer((req, res) => {
    lastHeaders = req.headers as Record<string, string>;
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      lastBody = raw;
      res.writeHead(currentRoute.status ?? 200, { 'Content-Type': 'text/event-stream' });
      for (const line of currentRoute.sse) res.write(line);
      res.end();
    });
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  serverUrl = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
}

/**
 * Redirige las peticiones de los adaptadores al servidor local de prueba,
 * conservando ruta y cabeceras. Se restaura con la funcion devuelta.
 */
function useLocalServer(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    return original(url.replace(/^https?:\/\/[^/]+/, serverUrl), init);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'aurapet-ai-'));
  currentRoute = { sse: [] };
  await startServer();
});

afterEach(async () => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function storeWithKey(provider: string, key = 'sk-test'): SecureStore {
  const store = new SecureStore(join(dir, 'c.enc'));
  store.set(`apiKey:${provider}`, key);
  return store;
}
describe('OpenAIAdapter', () => {
  it('no esta configurado sin clave', () => {
    const adapter = new OpenAIAdapter(new SecureStore(join(dir, 'c.enc')));
    expect(adapter.isConfigured()).toBe(false);
  });

  it('lanza un error claro si falta la clave', async () => {
    const adapter = new OpenAIAdapter(new SecureStore(join(dir, 'c.enc')));
    await expect(adapter.complete({ prompt: 'hola' })).rejects.toBeInstanceOf(AIProviderError);
  });

  it('reconstruye el texto del streaming SSE', async () => {
    const store = storeWithKey('openai');
    const restore = useLocalServer();
    currentRoute = {
      sse: [
        'data: {"choices":[{"delta":{"content":"Hola"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" mundo"}}]}\n\n',
        'data: [DONE]\n\n',
      ],
    };

    const result = await new OpenAIAdapter(store).complete({ prompt: 'hola' });
    restore();

    expect(result.text).toBe('Hola mundo');
    expect(result.provider).toBe('openai');
  });

  it('envia la cabecera Authorization con la clave', async () => {
    const store = storeWithKey('openai', 'sk-abc');
    const restore = useLocalServer();
    currentRoute = { sse: ['data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'] };

    await new OpenAIAdapter(store).complete({ prompt: 'hola' });
    restore();

    expect(lastHeaders['authorization']).toBe('Bearer sk-abc');
  });

  it('propaga un error HTTP con su estado', async () => {
    const store = storeWithKey('openai');
    const restore = useLocalServer();
    currentRoute = { status: 401, sse: [] };

    await expect(new OpenAIAdapter(store).complete({ prompt: 'hola' })).rejects.toMatchObject({
      status: 401,
    });
    restore();
  });
});

describe('AnthropicAdapter', () => {
  it('extrae texto de content_block_delta e ignora otros eventos', async () => {
    const store = storeWithKey('anthropic');
    const restore = useLocalServer();
    currentRoute = {
      sse: [
        'data: {"type":"message_start","message":{"id":"x"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"text":"Hola"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"text":"!"}}\n\n',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
      ],
    };

    const result = await new AnthropicAdapter(store).complete({ prompt: 'hola' });
    restore();

    expect(result.text).toBe('Hola!');
  });

  it('envia el system prompt en su propio campo', async () => {
    const store = storeWithKey('anthropic');
    const restore = useLocalServer();
    currentRoute = { sse: [] };

    await new AnthropicAdapter(store).complete({
      prompt: 'hola',
      systemPrompt: 'eres un asistente',
    });
    restore();

    const body = JSON.parse(lastBody) as Record<string, unknown>;
    expect(body['system']).toBe('eres un asistente');
    expect(lastHeaders['anthropic-version']).toBeDefined();
  });
});

describe('fabrica de proveedores', () => {
  it('registra los proveedores de nube', () => {
    const disponibles = availableProviders();
    expect(disponibles).toContain('openai');
    expect(disponibles).toContain('anthropic');
  });

  it('no incluye los locales todavia (los aporta Dev B)', () => {
    // Ollama y LM Studio llegan en el Sprint 3 Dev B.
    expect(availableProviders()).not.toContain('ollama');
  });

  it('createProvider devuelve el adaptador correcto', () => {
    const store = new SecureStore(join(dir, 'c.enc'));
    expect(createProvider('openai', store).id).toBe('openai');
    expect(createProvider('anthropic', store).id).toBe('anthropic');
  });

  it('lanza si se pide un proveedor no registrado', () => {
    const store = new SecureStore(join(dir, 'c.enc'));
    expect(() => createProvider('ollama', store)).toThrow(AIProviderError);
  });

  it('permite registrar un proveedor nuevo sin tocar los existentes', () => {
    const store = new SecureStore(join(dir, 'c.enc'));

    class Fake implements AIProvider {
      readonly id = 'ollama' as const;
      readonly defaultModel = 'llama3.1';
      isConfigured(): boolean {
        return true;
      }
      async *stream(): AsyncIterable<string> {
        yield 'ok';
      }
      async complete(): Promise<never> {
        throw new Error('no usado en este test');
      }
    }

    registerProvider('ollama', () => new Fake());

    expect(availableProviders()).toContain('ollama');
    expect(createProvider('ollama', store).isConfigured()).toBe(true);
  });

  it('isProviderConfigured consulta sin exponer la clave', () => {
    const store = new SecureStore(join(dir, 'c.enc'));
    expect(isProviderConfigured('openai', store)).toBe(false);
    store.set('apiKey:openai', 'sk-x');
    expect(isProviderConfigured('openai', store)).toBe(true);
  });
});