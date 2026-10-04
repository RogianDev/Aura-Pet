# Sprint 2 — Dev A: WebSocket, eventos de CLI y bandeja del sistema

**Developer:** Dev A (`main`) · **Track:** Backend / proceso principal
**Rama:** `feature/sprint2-websocket` · **Complemento:** `docs/SPRINT-2-DEV-B.md` (Dev B)

---

## Alcance del sprint

Según el PDR §9, el Sprint 2 reparte el trabajo así:

| Developer | Tarea asignada | Estado |
| --- | --- | --- |
| **Dev A** | Implementación del servidor de WebSockets y eventos de CLI local | ✅ Completo |
| **Dev B** | Animaciones con Framer Motion, hooks de seguimiento de cursor y Zustand stores | ✅ Completo |

Este documento cubre **únicamente el track de Dev A**. El trabajo de Dev B
(hooks, animaciones por ánimo y stores) está documentado aparte en
`SPRINT-2-DEV-B.md`.

---

## Requisitos cubiertos

| ID | Requisito | Implementación |
| --- | --- | --- |
| **RF-05** | Receptor de eventos WebSocket | `src/main/sockets/WebSocketServer.ts` |
| **RF-04** | Bandeja del sistema | `src/main/tray/TrayManager.ts` |

Ambos completan la lista de requisitos funcionales del §3 que Sprint 1 dejó
pendientes.

---

## RF-05 — Servidor WebSocket de eventos de CLI

### Decisiones de diseño

Las decisiones se tomaron **antes de escribir código**, mediante una revisión
explícita del diseño:

| Decisión | Valor | Motivo |
| --- | --- | --- |
| Transporte | `ws://localhost:9001` | Solo local, el tráfico no sale de la máquina |
| Formato | JSON con `type` discriminante | Permite añadir eventos sin romper los antiguos |
| Nº de eventos | 2 (`started`, `finished`) | Cubren el 80% del uso real |
| Reacción a fallo | `alert` (marcada) | Un comando fallido genera una señal más expresiva |
| Ejecución de comandos | **Ninguna** | El servidor solo *escucha*; si ejecutara, un evento malformado podría lanzar acciones |

### Ficheros

```
src/main/sockets/
├── WebSocketServer.ts   # Ciclo de vida, conexiones, timeout de inactividad
└── events.ts            # Validación y traducción a ánimo de la mascota
```

### Validación (el punto más delicado)

Un `JSON.parse` sin protección es un fallo esperando a ocurrir. Reglas aplicadas:

| Regla | Motivo |
| --- | --- |
| Límite de 64 KB por mensaje | Evita agotar memoria con un payload enorme |
| Lista blanca de `type` | Descarta eventos desconocidos |
| `try/catch` alrededor del parseo | Un mensaje malo **nunca** tumba el servidor |
| Timeout de 30 s de inactividad | Cierra conexiones zombis |
| Escucha **solo en `127.0.0.1`** | El servidor es local por diseño; exponerlo sería una vulnerabilidad |

### Traducción a estado

| Evento | Condición | Ánimo |
| --- | --- | --- |
| `cli.command.started` | — | `curious` |
| `cli.command.finished` | `exitCode: 0` | `happy` |
| `cli.command.finished` | `exitCode ≠ 0` | `alert` |
### Flujo completo

```
CLI ──WebSocket──> events.ts (valida) ──> applyPetMood()
                                              │
                                              ├─> guarda estado en Main
                                              └─> IPC push (PET_MOOD_CHANGED)
                                                        │
                                                        ▼
                                              Renderer: setMood()
                                                        │
                                                        ▼
                                              PetAvatar (cambia color y postura)
```

---

## RF-04 — Bandeja del sistema

### Por qué es imprescindible

`WindowManager` intercepta el cierre de ventana y **solo la oculta**
(`event.preventDefault()`). Sin bandeja, el usuario cerraría la ventana y se
quedaría **sin ninguna forma de volver a abrir la aplicación**: el proceso
seguiría vivo, pero inalcanzable. La bandeja es el punto de retorno.

### Implementación

- Icono generado **en memoria** como bitmap BGRA con
  `nativeImage.createFromBitmap`. Evita depender de un `.ico` externo: un
  recurso ausente haría fallar la construcción de la `Tray` y la app no
  arrancaría.
- Menú contextual con *Mostrar / Ocultar* y *Salir*.
- Click izquierdo en el icono alterna la visibilidad.

### Detalle no obvio: la acción "Salir"

Cerrar la ventana está interceptado, así que **"Salir" no habría cerrado la
app**: el handler de `close` la volvería a esconder. Por eso existe
`WindowManager.setKeepInTray(false)`, que desactiva el ocultado antes de
destruir la ventana. Sin ese detalle, el menú de la bandeja no tiene salida.

---

## Pruebas

| Fichero | Cobertura |
| --- | --- |
| `tests/main/events.test.ts` | Validación de payloads, lista blanca, límites, traducción de ánimo |
| `tests/main/websocketServer.test.ts` | Ciclo de vida, `TC-SOC-001`, clientes simultáneos, mensajes malformados |

**Criterio de aceptación del §5 (`TC-SOC-001`):** las alertas deben cambiar el
estado en **menos de 50 ms**. Verificado con un test que mide la latencia real
sobre un servidor WebSocket en marcha.

### Resultado

```
Test Files  9 passed (9)
Tests       112 passed (112)
npm audit   0 vulnerabilities
```

---

## Incidencias encontradas y resueltas

Durante la verificación manual aparecieron **tres fallos encadenados**. Se
documentan porque son el aprendizaje útil del sprint:

| # | Incidencia | Origen | Resolución |
| --- | --- | --- | --- |
| 1 | El push de ánimo Main → Renderer no existía: el estado cambiaba en Main pero nunca llegaba a la pantalla | Diseño incompleto | Nuevo canal `PET_MOOD_CHANGED` + suscripción en el renderer |
| 2 | La ruta del preload tenía un nivel de menos y **nunca se cargó** | Sprint 1, nunca detectado | `join(__dirname, '../../preload/index.js')` |
| 3 | `sandbox: true` impedía el `require` relativo del preload | Sprint 1, enmascaraba el #2 | `sandbox: false` (ver abajo) |

**Lección:** los tests unitarios no detectaron ninguno de los tres. Los fallos
solo aparecieron al ejecutar la aplicación real y observar el comportamiento.
La prueba que faltaba era de **integración vertical** (evento → pantalla).

### Decisión de seguridad asociada

`sandbox: false` es una **pérdida de una capa de aislamiento**: los preloads en
sandbox no pueden importar ficheros relativos, y el nuestro importa
`../shared/contracts`.

Lo que **sigue vigente** es lo que exige el PDR:
- `contextIsolation: true` ✅
- `nodeIntegration: false` ✅
- El renderer no tiene acceso a Node ni al sistema de archivos ✅
- El preload sigue siendo la única frontera expuesta (§4.1) ✅

---

## Verificación manual

Para comprobar el funcionamiento local:

```bash
npm run dev
```

En otra terminal:

```bash
# → mascota curiosa
node -e "const WebSocket=require('ws');const w=new WebSocket('ws://localhost:9001');w.on('open',()=>w.send(JSON.stringify({type:'cli.command.started',data:{command:'npm test'}})));setTimeout(()=>process.exit(0),2000)"

# → mascota feliz
node -e "const WebSocket=require('ws');const w=new WebSocket('ws://localhost:9001');w.on('open',()=>w.send(JSON.stringify({type:'cli.command.finished',data:{command:'npm test',exitCode:0}})));setTimeout(()=>process.exit(0),2000)"

# → mascota en alerta (rosa)
node -e "const WebSocket=require('ws');const w=new WebSocket('ws://localhost:9001');w.on('open',()=>w.send(JSON.stringify({type:'cli.command.finished',data:{command:'npm test',exitCode:1}})));setTimeout(()=>process.exit(0),2000)"
```

Comprobar RF-04: cerrar la ventana con la ✕ y comprobar que **no desaparece**
el icono de la bandeja; click en él para volver a mostrar la mascota; menú
*Salir* para cerrar la aplicación.

---

## Ficheros del track

| Ruta | Descripción |
| --- | --- |
| `src/main/sockets/WebSocketServer.ts` | Servidor de eventos de CLI |
| `src/main/sockets/events.ts` | Validación y traducción de eventos |
| `src/main/tray/TrayManager.ts` | Bandeja del sistema y menú contextual |
| `tests/main/events.test.ts` | Tests de validación |
| `tests/main/websocketServer.test.ts` | Tests de integración |

## Ficheros compartidos tocados

Conforme al §11.1 del PDR, el ownership es por carpetas. Este track tocó
archivos de **propiedad compartida**, algo que debe anunciarse en el PR:

| Fichero | Motivo |
| --- | --- |
| `src/shared/contracts.ts` | Tipos de evento y canal `PET_MOOD_CHANGED` (aditivo, no altera tipos existentes) |
| `src/preload/index.ts` | Exposición de `onMoodChange` |
| `src/renderer/App.tsx` | Suscripción al push (8 líneas, no altera el trabajo de Dev B) |
| `src/main/index.ts` | Ciclo de vida de la bandeja y del servidor |
| `src/main/window/WindowManager.ts` | `setKeepInTray` y corrección de rutas |

---

## Pendiente para el Sprint 3

- [ ] **Empaquetar el preload** con esbuild para recuperar `sandbox: true`
- [ ] **Warning de Framer Motion**: `animate opacity from "undefined" to "0.45"` (en `src/renderer/`, territorio de Dev B)
- [ ] **`safeStorage` (DPAPI)** para ajustes y claves de IA
- [ ] **Adaptadores de IA**: OpenAI, Anthropic, Ollama y LM Studio
**Deuda técnica:** empaquetar el preload con esbuild para recuperar el sandbox.