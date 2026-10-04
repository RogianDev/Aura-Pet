import type { SecureStore } from '../storage/SecureStore';
import { BaseHttpProvider, readSseStream, toProviderError, withTimeout } from './BaseHttpProvider';
import { AIProviderError, type CompletionRequest } from './AIProvider';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/**
 * AnthropicAdapter — Proveedor de IA en la nube.
 *
 * La API de Anthropic exige la cabecera `anthropic-version` y coloca el
 * prompt de sistema en un campo aparte, no en la lista de mensajes como
 * OpenAI. Esa diferencia queda aislada en este adaptador.
 */
export class AnthropicAdapter extends BaseHttpProvider {
  readonly id = 'anthropic' as const;
  readonly defaultModel = 'claude-3-5-sonnet-latest';

  private readonly store: SecureStore;
  private readonly model: string;

  constructor(store: SecureStore, model?: string) {
    super();
    this.store = store;
    this.model = model ?? this.defaultModel;
  }

  isConfigured(): boolean {
    return this.store.isConfigured('anthropic');
  }

  async *stream(request: CompletionRequest): AsyncIterable<string> {
    const apiKey = this.store.get('apiKey:anthropic');
    if (!apiKey) {
      throw toProviderError(this.id, new Error('Falta la clave de API de Anthropic'));
    }

    const { signal, dispose } = withTimeout(request.signal, 60_000);

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          // El system prompt va aparte en Anthropic, no en `messages`.
          ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
          messages: [{ role: 'user', content: request.prompt }],
          stream: true,
          max_tokens: request.maxTokens ?? 1024,
          temperature: request.temperature ?? 0.7,
        }),
      });

      if (!response.ok || !response.body) {
        // Se lanza directamente (y no via toProviderError) porque hace falta
        // conservar el codigo HTTP: toProviderError solo normaliza la causa.
        throw new AIProviderError(this.id, `El proveedor devolvio HTTP ${response.status}`, response.status);
      }

      yield* readSseStream(response.body, (data) => {
        try {
          const json = JSON.parse(data) as {
            type?: string;
            delta?: { text?: string };
          };
          // Anthropic emite varios tipos de evento; solo nos interesa el texto.
          return json.type === 'content_block_delta' ? (json.delta?.text ?? null) : null;
        } catch {
          return null;
        }
      });
    } catch (error) {
      throw toProviderError(this.id, error);
    } finally {
      dispose();
    }
  }
}