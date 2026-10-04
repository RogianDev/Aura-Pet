# AuraPet — Documento de Requisitos de Producto (PDR) & Guía de Colaboración Git/GitHub

| Versión | Fecha | Equipo | Control de código |
| --- | --- | --- | --- |
| 1.4.0 | Octubre 2026 | 2+ Desarrolladores | GitHub / Git-Flow |

> **Fuente:** `Documento de Requisitos de Producto (PDR) - AuraPet.pdf` (5 páginas).
> **Nota de conversión:** los bloques de código del PDF original (estructura de carpetas, diagrama de flujo IPC, comandos Git y cheat sheet) estaban truncados en el propio PDF por saltos de línea. Fueron reconstruidos de forma coherente con el contexto del documento y se marcan con `> [!NOTE]`.

---

## 1. Visión general del producto

AuraPet es un asistente flotante de escritorio para Windows que combina un compañero interactivo SVG con físicas de resortes, automatización de terminal, panel de control desplegable y motor multi-proveedor de Inteligencia Artificial (Nube y Local Ollama).

### 1.1 Propósito del producto (v1.4.0)

**AuraPet es un asistente de uso diario que ayuda con tareas cotidianas, automatiza el trabajo repetitivo y guarda el contexto de lo que estás haciendo para actuar como soporte.**

Este propósito se concreta en tres funciones, por orden de prioridad:

| # | Función | Qué significa en la práctica |
| --- | --- | --- |
| **1** | **Ayuda del día a día** | Responder preguntas rápidas sin salir de lo que haces: "¿qué hace este error?", "¿cómo se llama este comando?" |
| **2** | **Automatización** | Reaccionar a lo que ya pasa: avisar cuando un build falla, resumir la salida de un comando largo, encadenar tareas |
| **3** | **Asistente de contexto** | Recordar proyectos, decisiones y tareas; saber en qué estás trabajando sin que se lo repitas |

### 1.2 Qué es y qué no es AuraPet

| Es | No es |
| --- | --- |
| Un asistente **reactivo**: observa tu sistema y actúa cuando ocurre algo | Un agente autónomo que hace cosas por su cuenta sin avisar |
| Una capa de **contexto** que recuerda en qué trabajas | Un sustituto del terminal: la ejecuta **tú**, AuraPet observa |
| Un **notificador** que resume y prioriza | Un sistema que ejecuta comandos por su cuenta sin permiso |

> [!IMPORTANT]
> **Límite de seguridad heredado del Sprint 2.** El servidor de eventos (RF-05)
> **solo escucha, nunca ejecuta**. Este diseño se mantiene de forma deliberada:
> si el asistente pudiera actuar por su cuenta, un evento malformado o una
> instrucción inyectada a través del contexto de la IA se convertirían en
> ejecución de comandos. **Cualquier función de acción requerirá confirmación
> explícita del usuario y un catálogo de acciones permitidas.**

### 1.3 Enfoque de fases

Las tres funciones de 1.1 no se entregan de golpe. Cada una es un incremento
que aporta valor por sí mismo:

1. **Notificar** — ver y entender lo que pasa (base sobre la que construir)
2. **Resumir** — convertir ruido en información accionable
3. **Recordar** — mantener el contexto del proyecto
4. **Automatizar** — encadenar reglas, siempre con confirmación

## 2. Stack tecnológico completo

| Área | Tecnología |
| --- | --- |
| Core & Runtime | Electron, Node.js, TypeScript |
| Frontend & UI | React 18, Vite, Tailwind CSS |
| Animación vectorial | Framer Motion (físicas SVG e interacciones) |
| Gestión de estado | Zustand (`petMoodStore`, `uiStore`, `settingsStore`) |
| Comunicación External/CLI | WebSocket Server (`ws`) local |
| Seguridad | Electron `safeStorage` (Windows DPAPI) + `contextBridge` |
| Testing & QA | Vitest y Playwright |
## 3. Requisitos funcionales (RF) y no funcionales (RNF)

| ID | Nombre | Descripción |
| --- | --- | --- |
| RF-01 | Ventana flotante transparente | Ventana nativa frameless, transparente, siempre visible (always-on-top) y arrastrable. |
| RF-02 | Mascota vectorial SVG + Framer Motion | Mascota reactiva con seguimiento de cursor, parpadeo aleatorio y físicas de resortes. |
| RF-03 | Panel de chat y ajustes | Despliegue de interfaz de conversación y configuración. |
| RF-04 | Bandeja del sistema | Icono de System Tray con menú contextual. |
| RF-05 | Receptor de eventos WebSocket | Servidor `ws` para escuchar alertas desde la CLI. |
| RNF-01 / RNF-02 | Rendimiento y seguridad | Uso de CPU < 1%, RAM ≤ 120 MB y aislamiento de contexto (`contextIsolation: true`). |
## 4. Arquitectura detallada del sistema (Clean Architecture)

AuraPet adopta un modelo estricto de desacoplamiento para garantizar la seguridad de Electron y facilitar el desarrollo simultáneo entre varios programadores sin colisiones de código.

### 4.1 Aislamiento de procesos (Main vs Renderer)

- **Proceso principal (Main - Node.js):** responsable del ciclo de vida del sistema operativo, creación de ventanas transparentes, almacenamiento seguro mediante Windows DPAPI (`safeStorage`), persistencia en disco y servidor WebSocket. Ningún código de UI se ejecuta en Main.
- **Capa de puente (Preload - Context Bridge):** actúa como un *firewall* estricto. Expone únicamente una API tipada y congelada (`window.aurapetAPI`) hacia el renderer mediante `contextBridge.exposeInMainWorld()`. Desactiva explícitamente `nodeIntegration`.
- **Proceso de renderizado (Renderer - React):** responsable exclusivo de la interfaz gráfica, animaciones vectoriales SVG y gestión de estado visual con Zustand. No tiene acceso directo al sistema de archivos ni a Node.js.

### 4.2 Estructura detallada de carpetas

> [!NOTE]
> Bloque reconstruido a partir del fragmento legible del PDF.

```text
src/
├── main/                     # PROCESO PRINCIPAL (Node.js)
│   ├── core/                 # Capa de Dominio / Casos de Uso
│   ├── ipc/                  # Handlers y canales IPC
│   ├── sockets/              # WebSocketServer (ws) — eventos de CLI
│   ├── ai-providers/         # Adaptadores: OpenAI / Anthropic / Ollama / LM Studio
│   ├── window/               # WindowManager (ventana frameless transparente)
│   ├── storage/              # safeStorage (DPAPI) + persistencia en disco
│   └── tray/                 # Bandeja del sistema (System Tray)
├── preload/                  # contextBridge -> window.aurapetAPI (API tipada y congelada)
├── renderer/                 # PROCESO DE RENDERIZADO (React)
│   ├── components/
│   │   ├── PetAvatar/        # Mascota SVG reactiva
│   │   ├── ChatPanel/        # RF-03 Panel de chat
│   │   └── SettingsPanel/    # RF-03 Panel de ajustes
│   ├── hooks/                # Seguimiento de cursor, físicas, sockets
│   ├── stores/               # petMoodStore, uiStore, settingsStore
│   └── styles/               # Tailwind CSS
├── shared/                   # Tipos y contratos compartidos Main <-> Renderer
└── tests/                    # Vitest (unit) + Playwright (E2E)
```

### 4.3 Flujo de datos e interacción IPC

Toda la comunicación entre la mascota y los servicios locales/nube sigue un flujo uni-direccional claro:

> [!NOTE]
> Diagrama reconstruido a partir del fragmento legible del PDF.

```text
[Usuario / CLI Event]
        │
        ▼
[WebSocket / UI Chat]
        │
        ▼
[Renderer: Zustand Store]
        │  (ipcRenderer.invoke / contextBridge)
        ▼
[Preload: window.aurapetAPI] ──► [Main: Core / Casos de Uso]
        │                            │
        │                            ├─► ai-providers (Nube / Ollama)
        │                            ├─► safeStorage (DPAPI)
        │                            └─► System Tray
        ▼
[Renderer: PetAvatar (estado + animaciones)]
```

## 5. Matriz de control de calidad

| ID Req. | Componente | Caso de prueba | Criterio de aceptación |
| --- | --- | --- | --- |
| RF-01 | `main/WindowManager` | `TC-WIN-001` | Ventana transparente frameless sin bordes ni destellos. |
| RF-02 | `renderer/PetAvatar` | `TC-PET-001` | Respuesta de pupilas al cursor < 16 ms a 60 fps sin tirones. |
| RF-05 | `main/sockets/WebSocketServer` | `TC-SOC-001` | Alertas por `ws://localhost:9001` cambian estado en < 50 ms. |
| RF-07 | `main/ai-providers/OllamaAdapter` | `TC-AI-001` | Intercepción de errores si el servicio de Ollama no responde. |

## 6. Matriz de riesgos

| ID | Riesgo identificado | Impacto | Estrategia de mitigación |
| --- | --- | --- | --- |
| R-01 | Carga de CPU por seguimiento del mouse. | Medio | Throttling con `requestAnimationFrame`. |
| R-02 | Bloqueo de UI durante streaming de IA. | Alto | Procesamiento asíncrono no bloqueante en Main. |
| R-03 | Conflictos en código por trabajo paralelo. | Crítico | Flujo estricto Feature-Branch con Pull Requests y Rebase. |

## 7. Guía de colaboración en equipo (GitHub Workflows)

Para trabajar de forma fluida entre 2 o más desarrolladores sin sobrescribir código ni generar conflictos en la rama principal (`main`), el equipo seguirá la siguiente estrategia:

- **Regla de rama principal (`main`):** la rama `main` debe ser sagrada y siempre estable/compilable. Se protegerá en GitHub impidiendo *direct pushes*.
- **Estrategia Feature-Branch:** cada desarrollador trabajará en una rama individual para cada tarea (ej. `feature/pet-animations`, `feature/ollama-adapter`, `fix/socket-reconnect`).
- **Aprobación mediante Pull Request (PR):** todo cambio requiere revisión de código (*Code Review*) por al menos 1 compañero antes de integrarse.

### Flujo paso a paso para un integrante del equipo

> [!NOTE]
> Comandos reconstruidos a partir del fragmento legible del PDF.

```bash
# 1. Clonar el repositorio por primera vez
git clone https://github.com/TU-ORGANIZACION/aurapet.git
cd aurapet

# 2. Actualizar el repositorio y crear su rama de trabajo
git checkout main
git pull origin main
git checkout -b feature/mi-tarea

# 3. Desarrollar y guardar cambios con Conventional Commits
git add .
git commit -m "feat: descripcion de la funcionalidad"

# 4. Publicar la rama y abrir el Pull Request
git push -u origin feature/mi-tarea
# (abrir el PR desde la interfaz de GitHub hacia `main`)

# 5. Tras la aprobacion, actualizar la rama local
git checkout main
git pull origin main
```

### Gestión de conflictos entre desarrolladores

Cuando 2 desarrolladores modifican el mismo archivo al mismo tiempo, sigue este procedimiento con `git rebase` para mantener un historial limpio:

```bash
# Mientras estas en tu rama de trabajo
git fetch origin
git rebase origin/main

# Si Git reporta conflictos:
#   1. Corrige manualmente los archivos marcados en conflicto
#   2. git add <archivos-resueltos>
#   3. git rebase --continue

# Al finalizar, actualizar tu rama remota
git push --force-with-lease
```

## 8. Buenas prácticas y reglas del equipo en GitHub

- **Conventional Commits:** usar prefijos como `feat:` (nueva funcionalidad), `fix:` (corrección de bug), `refactor:` (mejora de código sin cambiar funcionalidad), `docs:` (documentación).
- **Integración continua (CI):** antes de aprobar un PR, GitHub Actions ejecutará automáticamente `npm run test` y `npm run build`. Si las pruebas fallan, el PR no se podrá fusionar.
- **Variables de entorno locales:** NUNCA subir claves de API o archivos `.env` al repositorio. Se debe incluir un archivo de plantilla `.env.example`.

## 9. Planificación ágil por sprints (equipo de 2+)

> [!NOTE]
> **Revisión v1.4.0.** Los sprints 1 y 2 se ejecutaron según lo planificado.
> A partir del Sprint 3, la planificación se amplía para cubrir el propósito
> definido en la sección 1.1. La ampliación se justifica en 9.1.

### Sprint 1 — Fundaciones y arquitectura ✅ Completado

- **Dev A:** Configuración de Electron + Clean Architecture, `WindowManager` y IPC Handlers.
- **Dev B:** Configuración de React + Vite + Tailwind CSS y componentes de `PetAvatar` SVG.

### Sprint 2 — UI, físicas y sockets ✅ Completado

- **Dev A:** Implementación del servidor de WebSockets y eventos de CLI local (RF-05) y bandeja del sistema (RF-04).
- **Dev B:** Animaciones con Framer Motion, hooks de seguimiento de cursor y Zustand stores.

### 9.1 Por qué se amplía la planificación

El Sprint 3 original ("Integración de IA y seguridad") cubre **infraestructura
que el usuario no ve**: almacenamiento seguro y adaptadores de proveedores.
Por sí solo no produce nada útil en pantalla.

Además, al definir el propósito del producto (sección 1.1) aparecen necesidades
que el PDR v1.2.0 no recogía:

| Necesidad detectada | Requisito asociado | Sprint |
| --- | --- | --- |
| Una interfaz para preguntar y para configurar | **RF-03** (nunca implementado) | 4 |
| Un canal para que herramientas reporten eventos | **RF-05** ampliado | 4 |
| Una memoria del proyecto | **Nuevo: RF-06** | 5 |
| Un motor de reglas | **Nuevo: RF-07** | 6 |

> **Lo que NO cambia:** la arquitectura, la separación de procesos, el servidor
> WebSocket ya construido y la mascota. La ampliación **aporta encima**, no
> rehace lo anterior.

### Sprint 3 — Infraestructura de IA y persistencia

Objetivo: que la IA exista y que sus claves estén a salvo. Sin UI todavía.

- **Dev A:** `safeStorage` (DPAPI) para credenciales; adaptadores de OpenAI y Anthropic; interfaz común `AIProvider`.
- **Dev B:** Adaptador de Ollama y LM Studio; estado de carga y error de las peticiones en la UI.

**Criterio de salida:** se puede enviar un prompt desde un test y obtener respuesta de un proveedor real, con la clave guardada cifrada.

### Sprint 4 — Interfaz: chat y ajustes (fase "notificar")

Objetivo: **la primera función visible de la sección 1.1.**

- **Dev A:** Handler IPC de chat; streaming de respuestas token a token (evita el bloqueo de UI descrito en R-02).
- **Dev B:** Panel de chat desplegable (RF-03), panel de ajustes (RF-03) con selección de proveedor.

**Criterio de salida:** el usuario pregunta algo desde el panel y recibe respuesta.

### Sprint 5 — Eventos y resumen (fase "resumir")

Objetivo: convertir el ruido de la terminal en información accionable.

- **Dev A:** Ampliar el protocolo de eventos del WebSocket (`build.completed`, `error`, `test.failed`); captura de la salida del comando; cola de notificaciones.
- **Dev B:** Centro de notificaciones; resumen de la salida con la IA; agrupar y silenciar repetidos.

**Criterio de salida:** un build fallido genera una notificación legible sin haber mirado la terminal.

### Sprint 6 — Contexto y memoria (fase "recordar")

Objetivo: que AuraPet sepa en qué estás trabajando.

- **Dev A:** Almacenamiento local de contexto (notas, tareas, proyectos); recuperación por relevancia; comando para que la CLI reporte hitos (`aura-pet context add "..."`).
- **Dev B:** Vista de contexto en el panel; indicador visual de "proyecto activo"; edición y borrado.

**Criterio de salida:** AuraPet responde "¿en qué estoy trabajando?" sin que se lo pregunten de nuevo.

### Sprint 7 — Automatización (fase "automatizar")

> [!WARNING]
> Es el sprint con más riesgo de seguridad. Toda acción requiere confirmación
> explícita y solo puede invocar un catálogo cerrado de acciones permitidas
> (sección 1.2).

- **Dev A:** Motor de reglas (si ocurre X → proponer Y); gestor de tareas programadas; catálogo de acciones permitidas; registro de auditoría.
- **Dev B:** Editor visual de reglas; activación y desactivación; historial de ejecuciones.

**Criterio de salida:** una regla creada por el usuario se propone y ejecuta solo tras su confirmación.

### 9.2 Resumen de la hoja de ruta

| Sprint | FASE | Resultado visible |
| --- | --- | --- |
| 1 ✅ | Fundaciones | App arranca, ventana, mascota |
| 2 ✅ | Eventos | Reacciona a la CLI, bandeja del sistema |
| 3 | IA | *(ninguno todavía)* |
| 4 | Notificar | **Panel de chat y ajustes** |
| 5 | Resumir | **Notificaciones inteligentes** |
| 6 | Recordar | **Memoria del proyecto** |
| 7 | Automatizar | **Reglas con confirmación** |
| 8 | Distribución | Instalador y documentación de uso |

**El Sprint 3 es el único que no entrega valor visible por sí mismo.** Es
inevitable: la IA necesita credenciales seguras antes de poder mostrarse.

### 9.3 Requisitos funcionales resultantes

Se mantiene la tabla de la sección 3 y se añaden:

| ID | Requisito | Sprint |
| --- | --- | --- |
| RF-06 | Memoria de contexto del proyecto (notas, tareas, proyectos) | 6 |
| RF-07 | Motor de reglas de automatización con confirmación | 7 |
| RF-08 | Centro de notificaciones con resumen inteligente | 5 |

## 10. Cheat sheet de comandos de desarrollo y Git

> [!NOTE]
> Comandos reconstruidos a partir del fragmento legible del PDF.

```bash
# --- Comandos de desarrollo del proyecto ---
npm run dev       # Ejecuta la App con Hot Module Replacement
npm run build     # Compila el proyecto para producción
npm run test      # Ejecuta la suite de tests (Vitest)

# --- Comandos Git de uso frecuente ---
git status                    # Ver cambios locales
git log --oneline --graph     # Historial resumido
git switch -c <rama>         # Crear / cambiar de rama
git stash                     # Guardar cambios temporalmente
git stash pop                 # Recuperarlos
```

## 11. Protocolo de colaboración entre Developers (prevención de conflictos)

> [!NOTE]
> Sección añadida en la versión **1.3.0**. Complementa la sección 7 con el reparto de propiedad de archivos y el flujo de trabajo en paralelo de los 2 developers. La seccion 7 explica el flujo general; esta define **quien toca que** y **como evitar conflictos**.

### 11.1 Reparto de propiedad por carpeta

Cada developer es **dueno exclusivo** de su carpeta. El otro no modifica el codigo de esa zona sin avisar en el PR.

| Ruta | Dueno | Contenido |
| --- | --- | --- |
| `src/main/` | **Dev A** | Ciclo de vida, `WindowManager`, IPC handlers, sockets, `ai-providers/`, `storage/`, `tray/` |
| `src/preload/` | **Dev A** | Context bridge (`window.aurapetAPI`) |
| `src/renderer/` | **Dev B** | Componentes React, SVG, stores Zustand, estilos |
| `src/shared/contracts.ts` | **A y B (compartido)** | Ver 11.3 — archivo de mayor riesgo |
| `tests/` | Quien crea el modulo | Test junto al codigo que verifica |
| `package.json` / lockfile | **El que mergea primero** | Ver 11.2 |

### 11.2 Reglas para evitar conflictos

1. **Cada rama nace de `main`, nunca de otra feature branch.** Un PR debe contener solo el trabajo propio. Ramas apiladas (crear una rama sobre otra feature) estan prohibidas en trabajo en equipo: obligan al segundo developer a mergear primero para poder trabajar.

2. **`package.json` y `package-lock.json` tienen un unico dueno por PR.** El primer developer que mergee dependencias nuevas avisa en su PR. El segundo sincroniza (`git pull` + `npm install`) antes de abrir el suyo y vuelve a comprobar que el build funciona. Editar el lockfile a la vez produce conflictos que Git no puede resolver por si solo.

3. **Rebase antes de pedir revision.** Antes de abrir el PR, actualizar sobre el estado actual de `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   git push --force-with-lease
   ```

4. **Nunca usar `git push --force` a secas.** Solo `--force-with-lease`, y unicamente tras un rebase propio. Un `--force` sin mas puede destruir trabajo de otra persona.

5. **Comunicar los archivos sensibles en el PR.** Si un PR toca `src/shared/contracts.ts`, `package.json` o `.github/workflows/`, dejarlo escrito en la descripcion para que el otro developer haga `git pull` antes de seguir.

6. **Sincronizarse a diario.** Al empezar la jornada:
   ```bash
   git switch main
   git pull
   ```
   Trabajar sobre un `main` obsoleto es la causa mas comun de conflictos sorpresa al final del sprint.

### 11.3 El archivo de mayor riesgo: `src/shared/contracts.ts`

Es el unico archivo que **ambos developers necesitan consumir**. Un cambio aqui rompe la compilacion del otro hasta que sincroniza.

- **Cambios pequenos y frecuentes** son mejores que cambios grandes y raros.
- **No reordenar** canales IPC ni renombrar tipos sin avisar: genera conflictos absurdos en archivos que en realidad no cambiaste de verdad.
- Tras mergear un cambio en `contracts.ts`, el otro developer **debe** hacer `git pull && npm install` y ejecutar `npm run typecheck` antes de continuar.

### 11.4 Flujo diario de cada developer

```bash
# 1. Sincronizar con el estado mas reciente del equipo
git switch main
git pull origin main

# 2. Crear rama propia desde main (NUNCA desde otra feature)
git switch -c feature/mi-tarea

# 3. Trabajar y commitear con Conventional Commits
git add .
git commit -m "feat: descripcion clara del cambio"

# 4. Rebase sobre main actualizado antes de pedir revision
git fetch origin
git rebase origin/main

# 5. Publicar y abrir el PR
git push -u origin feature/mi-tarea
```

### 11.5 Revision de un PR ajeno — que mirar

| Situacion | Accion |
| --- | --- |
| El CI esta en rojo | NO mergear. El PR no fusiona mientras falle. |
| El PR toca `package.json` | Revisar con lupa las dependencias anadidas. |
| El PR toca `contracts.ts` | Avisar al autor de que rompe la compilacion local. |
| El PR toca carpetas del otro developer | Pedir justificacion antes de aprobar. |
| Todo verde y sin archivos sensibles | Aprobar y mergear. |

**Principio general:** el CI demuestra que el codigo *funciona*, no que sea *correcto* para el resto del equipo. Ese ultimo juicio sigue siendo humano.

---

*Documento original: AuraPet PDR — Documento Técnico, páginas 1 a 5.*
*Secciones 11 y 11.1-11.5 añadidas en la versión 1.3.0 (Octubre 2026).*
*Secciones 1.1-1.3, 9.1-9.3 y Sprint 3-8 añadidos en la versión 1.4.0 (Octubre 2026).*