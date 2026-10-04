import { AIProviderError, AI_PROVIDERS, type AIProvider, type AIProviderId } from './AIProvider';
import { AnthropicAdapter } from './AnthropicAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';
import type { SecureStore } from '../storage/SecureStore';

/**
 * Fabrica de proveedores de IA.
 *
 * Sprint 3 Dev A entrega los proveedores de nube (OpenAI, Anthropic).
 * Los locales (Ollama, LM Studio) se registran desde el Sprint 3 Dev B mediante
 * `registerProvider`, de modo que anadir uno nuevo no obliga a modificar este
 * fichero ni a los adaptadores existentes.
 */

const registry = new Map<AIProviderId, (store: SecureStore) => AIProvider>();

/** Registra un proveedor. Si ya existe, lo reemplaza. */
export function registerProvider(
  id: AIProviderId,
  factory: (store: SecureStore) => AIProvider,
): void {
  registry.set(id, factory);
}

registerProvider('openai', (store) => new OpenAIAdapter(store));
registerProvider('anthropic', (store) => new AnthropicAdapter(store));

/** Devuelve el adaptador del proveedor solicitado. */
export function createProvider(id: AIProviderId, store: SecureStore): AIProvider {
  const factory = registry.get(id);
  if (!factory) {
    throw new AIProviderError(id, `Proveedor no registrado: ${id}`);
  }
  return factory(store);
}

/** Proveedores registrados. Lo usa el panel de ajustes (Sprint 4). */
export function availableProviders(): AIProviderId[] {
  return [...AI_PROVIDERS].filter((id) => registry.has(id));
}

/** Indica si un proveedor concreto esta configurado (tiene clave guardada). */
export function isProviderConfigured(id: AIProviderId, store: SecureStore): boolean {
  const factory = registry.get(id);
  return factory ? factory(store).isConfigured() : false;
}

export { AIProviderError };
export type { AIProvider, AIProviderId };