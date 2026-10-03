# AuraPet — Documento de Requisitos de Producto (PDR) & Guía de Colaboración Git/GitHub

| Versión | Fecha | Equipo | Control de código |
| --- | --- | --- | --- |
| 1.2.0 | Octubre 2026 | 2+ Desarrolladores | GitHub / Git-Flow |

> **Fuente:** `Documento de Requisitos de Producto (PDR) - AuraPet.pdf` (5 páginas).
> **Nota de conversión:** los bloques de código del PDF original (estructura de carpetas, diagrama de flujo IPC, comandos Git y cheat sheet) estaban truncados en el propio PDF por saltos de línea. Fueron reconstruidos de forma coherente con el contexto del documento y se marcan con `> [!NOTE]`.

---

## 1. Visión general del producto

AuraPet es un asistente flotante de escritorio para Windows que combina un compañero interactivo SVG con físicas de resortes, automatización de terminal, panel de control desplegable y motor multi-proveedor de Inteligencia Artificial (Nube y Local Ollama).

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

### Sprint 1 — Fundaciones y arquitectura

- **Dev A:** Configuración de Electron + Clean Architecture, `WindowManager` y IPC Handlers.
- **Dev B:** Configuración de React + Vite + Tailwind CSS y componentes de `PetAvatar` SVG.

### Sprint 2 — UI, físicas y sockets

- **Dev A:** Implementación del servidor de WebSockets y eventos de CLI local.
- **Dev B:** Animaciones con Framer Motion, hooks de seguimiento de cursor y Zustand stores.

### Sprint 3 — Integración de IA y seguridad

- **Dev A:** Integración de `safeStorage` (DPAPI) y adaptadores de OpenAI / Anthropic.
- **Dev B:** Adaptador para Ollama/LM Studio local y panel de configuración UI.

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

---

*Documento original: AuraPet PDR — Documento Técnico, páginas 1 a 5.*