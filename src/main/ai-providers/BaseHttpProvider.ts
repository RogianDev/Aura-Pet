import {
  AIProviderError,
  type AIProviderId,
  type CompletionRequest,
  type CompletionResult,
  type AIProvider,
} from './AIProvider';

/**
 * BaseHttpProvider — Utilidades comunes de los proveedores HTTP.
 *
 * No se usan SDK oficiales: `fetch` nativo de Node 24 es suficiente y evita
 * anadir dependencias con vulnerabilidades propias.
 */

export const DEFAULT_TIMEOUT_MS = 60_000;

/** Lanza si la peticion no termina dentro del margen. */
export function withTimeout(signal: AbortSignal | undefined, ms: number): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), ms);

  const onAbort = (): void => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort, { once: true });

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

/** Normaliza cualquier fallo de red en un AIProviderError legible. */
export function toProviderError(provider: AIProviderId, error: unknown): AIProviderError {
  if (error instanceof AIProviderError) return error;
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message === 'timeout') {
      return new AIProviderError(provider, 'La peticion se cancelo o supero el tiempo limite.');
    }
    return new AIProviderError(provider, `Error de red: ${error.message}`);
  }
  return new AIProviderError(provider, 'Error desconocido contacting al proveedor.');
}

/**
 * Convierte un cuerpo SSE en trozos de texto.
 * Se usa para el streaming de OpenAI y Anthropic, cuyos formatos difieren
 * solo en como extraen el texto de cada linea `data:`.
 */
export async function* readSseStream(
  body: ReadableStream<Uint8Array>,
  extract: (data: string) => string | null,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Los eventos SSE se separan por linea en blanco.
      let index = buffer.indexOf('\n');
      while (index !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);

        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          const text = extract(data);
          if (text) yield text;
        }
        index = buffer.indexOf('\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Implementacion base: `complete` se deriva de `stream`. */
export abstract class BaseHttpProvider implements AIProvider {
  abstract readonly id: AIProviderId;
  abstract readonly defaultModel: string;
  abstract isConfigured(): boolean;
  // Publica (no protegida) para cumplir el contrato AIProvider: el panel de
  // chat del Sprint 4 consume el streaming desde fuera.
  abstract stream(request: CompletionRequest): AsyncIterable<string>;

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const parts: string[] = [];
    for await (const chunk of this.stream(request)) {
      parts.push(chunk);
    }
    return {
      text: parts.join(''),
      provider: this.id,
      model: this.defaultModel,
    };
  }
}