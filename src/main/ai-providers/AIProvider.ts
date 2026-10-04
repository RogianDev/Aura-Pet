/**
 * AIProvider — Interfaz comun de proveedores de IA (Sprint 3, Dev A).
 *
 * Todos los adaptadores (OpenAI, Anthropic, Ollama, LM Studio) implementan este
 * contrato, de modo que anadir un proveedor no obliga a tocar el resto del
 * sistema (seccion 4.2 del PDR).
 */

/** Identificadores de proveedor soportados. */
export const AI_PROVIDERS = ['openai', 'anthropic', 'ollama', 'lmstudio'] as const;
export type AIProviderId = (typeof AI_PROVIDERS)[number];

export interface CompletionRequest {
  prompt: string;
  /** Contexto previo, por ejemplo el historial de la conversacion. */
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  /** Indica que la peticion se cancela (el usuario cierra el panel). */
  signal?: AbortSignal;
}

export interface CompletionResult {
  text: string;
  provider: AIProviderId;
  model: string;
}

/** Error normalizado de cualquier proveedor. */
export class AIProviderError extends Error {
  public readonly provider: AIProviderId;
  public readonly status?: number;

  constructor(provider: AIProviderId, message: string, status?: number) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.status = status;
  }
}

export interface AIProvider {
  readonly id: AIProviderId;
  readonly defaultModel: string;

  /** Indica si el proveedor esta listo (p. ej. tiene clave configurada). */
  isConfigured(): boolean;

  /**
   * Peticion sin streaming: devuelve la respuesta completa.
   * Se construye sobre `stream` para no duplicar la llamada HTTP.
   */
  complete(request: CompletionRequest): Promise<CompletionResult>;

  /**
   * Peticion con streaming: emite trocen la respuesta segun llega.
   * Es lo que usara el panel de chat del Sprint 4, y lo que evita el bloqueo
   * de UI descrito en el riesgo R-02 del PDR.
   */
  stream(request: CompletionRequest): AsyncIterable<string>;
}