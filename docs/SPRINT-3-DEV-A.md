# Sprint 3 — Dev A: IA, credenciales cifradas y adaptadores

**Developer:** Dev A (`main`) — Track: Backend / proceso principal
**Rama:** `feature/dev-a-sprint3-ai-seguridad`

---

## Alcance entregado

| Developer | Tarea asignada | Estado |
| --- | --- | --- |
| **Dev A** | `safeStorage` (DPAPI) e interfaz comun `AIProvider` | Completado |
| **Dev A** | Adaptadores de OpenAI y Anthropic | Completado |
| **Dev B** | Adaptadores de Ollama y LM Studio, estado de carga en la UI | Pendiente (ver seccion 6) |

## Ficheros creados

```
src/main/
|- storage/SecureStore.ts          # Credenciales cifradas con safeStorage
`- ai-providers/
    |- AIProvider.ts               # Interfaz comun + AIProviderError
    |- BaseHttpProvider.ts         # Utilidades: timeout, SSE, errores
    |- OpenAIAdapter.ts            # Proveedor OpenAI (nube)
    |- AnthropicAdapter.ts         # Proveedor Anthropic (nube)
    `- index.ts                    # Fabrica con registro de proveedores
```

## Ficheros modificados

| Fichero | Cambio |
| --- | --- |
| `src/shared/contracts.ts` | 4 canales IPC nuevos, `ProviderInfo`, `AuraPetAPI.ai` |
| `src/main/ipc/handlers.ts` | Handlers de configuracion de IA |
| `src/preload/index.ts` | Exposicion de `api.ai` |

---

## 1. SecureStore — credenciales cifradas

Usa `safeStorage`, que en Windows delega en **DPAPI**: la clave de cifrado
pertenece al usuario del sistema, asi que el fichero no es descifrable ni por
otra cuenta ni por otra maquina.

| Decision | Motivo |
| --- | --- |
| Cifrado del **sistema**, no propio | No storing una clave maestra junto a los datos |
| Cache en memoria | Evita descifrar en cada lectura |
| Fichero corrupto: se descarta | Un error de descifrado no debe impedir que la app arranque |
| **Nunca** escribe en claro | Si DPAPI no esta disponible, lanza error en vez de degradar |

> **El renderer nunca recibe una clave.** Solo puede guardar, borrar o
> preguntar si existe. La garantia esta cubierta por un test explicito.

## 2. Interfaz AIProvider

Todos los proveedores implementan el mismo contrato, de modo que **anadir uno
no obliga a tocar el resto del sistema**:

## 3. Adaptadores

| | OpenAI | Anthropic |
| --- | --- | --- |
| Endpoint | `api.openai.com/v1/chat/completions` | `api.anthropic.com/v1/messages` |
| Autenticacion | `Authorization: Bearer` | `x-api-key` + `anthropic-version` |
| System prompt | En `messages` | Campo `system` aparte |
| Evento de texto | `choices[0].delta.content` | `content_block_delta` |

Las diferencias quedan **aisladas en cada adaptador**: quien anada un
proveedor copia el patron y no toca el resto.

### Decision: sin SDK oficiales

Se usa el **`fetch` nativo de Node 24**, sin dependencias nuevas.

| | Con SDK | Con `fetch` |
| --- | --- | --- |
| Dependencias | +1 por proveedor | **0** |
| Superficie de ataque | Cada SDK trae su propia | Ninguna adicional |

---

## 4. Configuracion por IPC

| Canal | Para que |
| --- | --- |
| `AI_LIST_PROVIDERS` | Que proveedores hay y cuales estan configurados |
| `AI_SET_API_KEY` | Guarda la clave cifrada |
| `AI_DELETE_API_KEY` | La elimina |
| `AI_SECURE_STORAGE_AVAILABLE` | Si el cifrado del sistema esta disponible |

Los handlers **validan** la entrada: proveedor desconocido, clave vacia o
cifrado no disponible lanzan un error legible en lugar de fallar en silencio.

---

## 5. Pruebas

| Fichero | Tests | Cobertura |
| --- | --- | --- |
| `tests/main/secureStore.test.ts` | 8 | Cifrado, cache, persistencia, corrupcion, borrado |

---

## 6. Que le toca a Dev B (pendiente)

Sin esto, los proveedores locales no funcionan. **La fabrica ya esta preparada.**

### Tarea 1 — Adaptadores locales

Crear `OllamaAdapter` y `LMStudioAdapter` en `src/main/ai-providers/`.

`LMStudioAdapter` **si** puede heredar de `BaseHttpProvider` (habla SSE
estandar). `OllamaAdapter` **no**: usa un formato JSON por lineas propio.

```ts
// Registro, dos lineas en index.ts y nada mas:
registerProvider('ollama', (store) => new OllamaAdapter(store));
registerProvider('lmstudio', (store) => new LMStudioAdapter(store));
```

Contrato a cumplir: `id`, `defaultModel`, `isConfigured()`, `stream()`, `complete()`.

Consideraciones especificas:
- `isConfigured()` debe devolver **`true`**: no hay clave.
- Leer la URL base de los **ajustes existentes** (`ollamaBaseUrl`), no fijarla.
- **No llamar a `SecureStore`**: los locales no tienen credenciales.

### Tarea 2 — Estado de carga y error en la UI

- `ProviderInfo` ya esta expuesta: `{ id, label, configured, requiresApiKey }`.
- Estados a representar: cargando / listo / sin configurar / error.
- Si `isSecureStorageAvailable()` devuelve `false`, **deshabilitar** el campo de
  clave y explicar por que.

### Verificacion

```bash
npx vitest run      # el contador de tests debe subir
npm run build
```

---

## Incidencias

| # | Incidencia | Resolucion |
| --- | --- | --- |
| 1 | El status HTTP se perdia al normalizar errores | Se lanza `AIProviderError` directamente cuando hay respuesta HTTP |
| 2 | `isSecureStorageAvailable` apuntaba al canal equivocado | Canal propio `AI_SECURE_STORAGE_AVAILABLE` |
| 3 | `stream` era `protected` en la clase base y publica en la interfaz | Alineado a publica: el panel de chat la consumira |

---

## Pendiente a futuro

- [ ] Recuperacion ante error 401: pedir de nuevo la clave en la UI
- [ ] Indicador de uso: avisar cuando el proveedor rechaza por saldo
- [ ] Empaquetar el preload con esbuild para recuperar `sandbox: true`

---

*Documento del track Dev A del Sprint 3. Complemento: `SPRINT-2-DEV-A.md`.*
| `tests/main/aiProviders.test.ts` | 13 | Streaming SSE real, cabeceras, errores HTTP, fabrica |
| `tests/ipc.handlers.test.ts` | +7 | Handlers de IA y garantia de no filtrar la clave |

**Resultado: 140 tests (antes 133).** 0 vulnerabilidades. Typecheck y build correctos.

### Dos cosas que los tests detectaron

| Hallazgo | Origen |
| --- | --- |
| El codigo de estado HTTP **se perdia** al normalizar el error | `toProviderError` solo recibia la causa, no el status |
| `isSecureStorageAvailable` llamaba al canal equivocado | Error de cableado del preload |

El primer bug habria hecho que la UI no pudiera distinguir un 401 de un 500.

### Sobre la prueba del streaming

Los tests **levantan un servidor HTTP real** que emite SSE y comprueban las
cabeceras recibidas. No se simula `fetch`: se verifica el parsing del stream
contra el formato real de cada proveedor.

```ts
interface AIProvider {
  id: AIProviderId;
  defaultModel: string;
  isConfigured(): boolean;
  complete(req): Promise<CompletionResult>;
  stream(req): AsyncIterable<string>;   // streaming token a token
}
```

**El streaming se diseno ahora aunque el panel de chat llegue en el Sprint 4.**
Es lo que evita el bloqueo de UI descrito en el riesgo **R-02** del PDR: la
respuesta se pinta conforme llega, no al final.

### Errores normalizados

`AIProviderError` unifica los fallos de cualquier proveedor y **conserva el
codigo HTTP**, para que la UI pueda distinguir "clave incorrecta" (401) de
"sin conexion" o "sin saldo".