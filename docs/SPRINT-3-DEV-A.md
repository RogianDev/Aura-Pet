# Sprint 3 — Dev A: IA, credenciales cifradas y adaptadores

**Developer:** Dev A (`main`) · **Track:** Backend / proceso principal
**Rama:** `feature/sprint3-ai-seguridad` · **Complemento:** `docs/SPRINT-2-DEV-A.md`

---

## Alcance entregado

Según el PDR §9, Sprint 3 reparte el trabajo así:

| Developer | Tarea asignada | Estado |
| --- | --- | --- |
| **Dev A** | `safeStorage` (DPAPI) e interfaz común `AIProvider` | ✅ Completo |
| **Dev A** | Adaptadores de OpenAI y Anthropic | ✅ Completo |
| **Dev B** | Adaptadores de Ollama y LM Studio, estado de carga en la UI | ⏭️ Pendiente (ver §6) |

---

## Ficheros creados

```
src/main/
├── storage/SecureStore.ts          # Credenciales cifradas con safeStorage
└── ai-providers/
    ├── AIProvider.ts               # Interfaz común + AIProviderError
    ├── BaseHttpProvider.ts         # Utilidades: timeout, SSE, errores
    ├── OpenAIAdapter.ts            # Proveedor OpenAI (nube)
    ├── AnthropicAdapter.ts         # Proveedor Anthropic (nube)
    └── index.ts                    # Fábrica con registro de proveedores
```

## Ficheros modificados

| Fichero | Cambio |
| --- | --- |
| `src/shared/contracts.ts` | 4 canales IPC nuevos, `ProviderInfo`, `AuraPetAPI.ai` |
| `src/main/ipc/handlers.ts` | Handlers de configuración de IA |
| `src/preload/index.ts` | Exposición de `api.ai` |

---

## 1. SecureStore — credenciales cifradas

Usa `safeStorage`, que en Windows delega en **DPAPI**: la clave de cifrado
pertenece al usuario del sistema, así que el fichero no es descifrable ni por
otra cuenta ni por otra máquina.

| Decisión | Motivo |
| --- | --- |
| Cifrado del **sistema**, no propio | No storing una clave maestra junto a los datos |
| Caché en memoria | Evita descifrar en cada lectura |
| Fichero corrupto → se descarta | Un error de descifrado no debe impedir que la app arranque |
| **Nunca** escribe en claro | Si DPAPI no está disponible, lanza error en vez de degradar |

> **El renderer nunca recibe una clave.** Solo puede guardar, borrar o
> preguntar si existe. La garantía está cubierta por un test explícito.

## 2. Interfaz AIProvider

Todos los proveedores implementan el mismo contrato, de modo que **añadir uno
no obliga a tocar el resto del sistema**:

```ts
interface AIProvider {
  id: AIProviderId;
  defaultModel: string;
  isConfigured(): boolean;
  complete(req): Promise<CompletionResult>;
  stream(req): AsyncIterable<string>;   // streaming token a token
}
```

**El streaming se diseñó ahora aunque el panel de chat llegue en el Sprint 4.**
Es lo que evita el bloqueo de UI descrito en el riesgo **R-02** del PDR: la
respuesta se pinta conforme llega, no al final.

### Errores normalizados

`AIProviderError` unifica los fallos de cualquier proveedor y **conserva el
código HTTP**, para que la UI pueda distinguir "clave incorrecta" (401) de
"sin conexión" o "sin saldo".
## 3. Adaptadores

| | OpenAI | Anthropic |
| --- | --- | --- |
| Endpoint | `api.openai.com/v1/chat/completions` | `api.anthropic.com/v1/messages` |
| Autenticación | `Authorization: Bearer` | `x-api-key` + `anthropic-version` |
| System prompt | En `messages` | Campo `system` aparte |
| Evento de texto | `choices[0].delta.content` | `content_block_delta` |

Las diferencias quedan **aisladas en cada adaptador**: quien añada un
proveedor copia el patrón y no toca el resto.

### Decisión: sin SDK oficiales

Se usa el **`fetch` nativo de Node 24**, sin dependencias nuevas.

| | Con SDK | Con `fetch` |
| --- | --- | --- |
| Dependencias | +1 por proveedor | **0** |
| Superficie de ataque | Cada SDK trae su propia | Ninguna adicional |

---

## 4. Configuración por IPC

| Canal | Para qué |
| --- | --- |
| `AI_LIST_PROVIDERS` | Qué proveedores hay y cuáles están configurados |
| `AI_SET_API_KEY` | Guarda la clave cifrada |
| `AI_DELETE_API_KEY` | La elimina |
| `AI_SECURE_STORAGE_AVAILABLE` | Si el cifrado del sistema está disponible |

Los handlers **validan** la entrada: proveedor desconocido, clave vacía o
cifrado no disponible lanzan un error legible en lugar de fallar en silencio.

---

## 5. Pruebas

| Fichero | Tests | Cobertura |
| --- | --- | --- |
| `tests/main/secureStore.test.ts` | 8 | Cifrado, caché, persistencia, corrupción, borrado |
| `tests/main/aiProviders.test.ts` | 13 | Streaming SSE real, cabeceras, errores HTTP, fábrica |
| `tests/ipc.handlers.test.ts` | +7 | Handlers de IA y garantía de no filtrar la clave |

**Resultado: 140 tests (antes 133).** 0 vulnerabilidades. Typecheck y build correctos.

### Dos cosas que los tests detectaron

| Hallazgo | Origen |
| --- | --- |
| El código de estado HTTP **se perdía** al normalizar el error | `toProviderError` solo recibía la causa, no el status |
| `isSecureStorageAvailable` llamaba al canal equivocado | Error de cableado del preload |

El primer bug habría hecho que la UI no pudiera distinguir un 401 de un 500.

### Sobre la prueba del streaming

Los tests **levantan un servidor HTTP real** que emite SSE y comprueban las
cabeceras recibidas. No se simula `fetch`: se verifica el parsing del stream
---

## 6. ⚠️ Qué le toca a Dev B (pendiente)

Sin esto, los proveedores locales no funcionan. **La fábrica ya está preparada.**

### Tarea 1 — Adaptadores locales

Crear `OllamaAdapter` y `LMStudioAdapter` en `src/main/ai-providers/`.
Pueden **no heredar** de `BaseHttpProvider`: Ollama tiene su propio formato y
no usa streaming SSE estándar.

```ts
// Registro — NO modificar index.ts más allá de estas dos líneas:
registerProvider('ollama', (store) => new OllamaAdapter(store));
registerProvider('lmstudio', (store) => new LMStudioAdapter(store));
```

**Contrato a cumplir:** `id`, `defaultModel`, `isConfigured()`, `stream()`,
`complete()`.

Consideraciones específicas:
- `isConfigured()` debe devolver **`true`**: no hay clave que guardar.
- Leer la URL base de los **ajustes existentes** (`ollamaBaseUrl`), no fijarla.
- **No llamar a `SecureStore`**: los locales no tienen credenciales.

### Tarea 2 — Estado de carga y error en la UI

- `ProviderInfo` ya está expuesta: `{ id, label, configured, requiresApiKey }`.
- Estados a representar: cargando / listo / sin configurar / error.
- Si `isSecureStorageAvailable()` devuelve `false`, **deshabilitar** el campo
  de clave y explicar por qué.

### Verificación

```bash
npx vitest run      # el contador de tests debe subir
npm run build
```

---

## Incidencias

| # | Incidencia | Resolución |
| --- | --- | --- |
| 1 | El status HTTP se perdía al normalizar errores | Se lanza `AIProviderError` directamente cuando hay respuesta HTTP |
| 2 | `isSecureStorageAvailable` apuntaba al canal equivocado | Canal propio `AI_SECURE_STORAGE_AVAILABLE` |
| 3 | `stream` era `protected` en la clase base y pública en la interfaz | Alineado a pública: el panel de chat la consumirá |

---

## Pendiente a futuro

- [ ] **Recuperación ante error 401**: pedir de nuevo la clave en la UI
- [ ] **Indicador de uso**: avisar cuando el proveedor rechaza por saldo
- [ ] **Empaquetar el preload** con esbuild para recuperar `sandbox: true`
contra el formato real de cada proveedor.