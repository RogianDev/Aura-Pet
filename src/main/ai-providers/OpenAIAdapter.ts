import type { SecureStore } from '../storage/SecureStore';
import { BaseHttpProvider, readSseStream, toProviderError, withTimeout } from './BaseHttpProvider';
import { AIProviderError, type CompletionRequest } from './AIProvider';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * OpenAIAdapter — Proveedor de IA en la nube.
 *
 * La clave se lee de SecureStore en cada peticion: no se mantiene en memoria
 * mas alla de la llamada ni se expone al renderer.
 */
export class OpenAIAdapter extends BaseHttpProvider {
  readonly id = 'openai' as const;
  readonly defaultModel = 'gpt-4o-mini';

  private readonly store: SecureStore;
  private readonly model: string;

  constructor(store: SecureStore, model?: string) {
    super();
    this.store = store;
    this.model = model ?? this.defaultModel;
  }

  isConfigured(): boolean {
    return this.store.isConfigured('openai');
  }

  async *stream(request: CompletionRequest): AsyncIterable<string> {
    const apiKey = this.store.get('apiKey:openai');
    if (!apiKey) {
      throw toProviderError(this.id, new Error('Falta la clave de API de OpenAI'));
    }

    const { signal, dispose } = withTimeout(request.signal, 60_000);

    try {
      const messages = [
        ...(request.systemPrompt
          ? [{ role: 'system', content: request.systemPrompt }]
          : []),
        { role: 'user', content: request.prompt },
      ];

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
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
            choices?: Array<{ delta?: { content?: string } }>;
          };
          return json.choices?.[0]?.delta?.content ?? null;
        } catch {
          // Una linea corrupta no debe cortar el stream entero.
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