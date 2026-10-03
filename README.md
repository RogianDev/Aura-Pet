# AuraPet 🐾

> Asistente flotante de escritorio para Windows con un compañero interactivo SVG,
> físicas de resortes, automatización de terminal y motor multi-proveedor de IA.

**Estado:** en desarrollo — Sprint 1 completado, Sprint 2 en curso.
**Documentación:** [PDR-AuraPet.md](./PDR-AuraPet.md) (Documento de Requisitos de Producto v1.3.0)

---

## ¿Qué es?

Una mascota de escritorio que vive siempre encima de tus ventanas, reacciona a tu
cursor, recibe alertas de la terminal y puede hablar contigo — con IA en la nube o
local con Ollama.

La Drawing (**PDR**) define el producto completo: visión general, requisitos,
arquitectura, planificación por sprints y protocolo de colaboración del equipo.

---

## Stack tecnológico

| Área | Tecnología |
| --- | --- |
| Core & Runtime | Electron 44, Node.js 24, TypeScript 5 |
| Frontend & UI | React 18, Vite 8, Tailwind CSS 4 |
| Animación vectorial | Framer Motion |
| Gestión de estado | Zustand |
| Comunicación CLI | WebSocket (`ws`) — *Sprint 2* |
| Seguridad | Electron `safeStorage` (Windows DPAPI) + `contextBridge` |
| Testing & QA | Vitest, Playwright — *Sprint 2* |

---

## Requisitos previos

- **Node.js 20 o superior**
- **npm 10 o superior**
- **Windows** (el proyecto usa DPAPI y ventanas nativas transparentes)

---

## Instalación

```bash
git clone https://github.com/RogianDev/Aura-Pet.git
cd Aura-Pet
npm install
```

## Uso

```bash
npm run dev       # Arranca la app con Hot Module Replacement
```

Abre una ventana flotante transparente con la mascota. Arrástrala desde el cuerpo
para moverla; interactúa con ella para cambiar su ánimo.

### Otros comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | App completa con HMR (Vite + Electron) |
| `npm run build` | Compila Main y renderer para producción |
| `npm run test` | Ejecuta los tests (Vitest) |
| `npm run test:watch` | Tests en modo interactivo |
| `npm run typecheck` | Verifica tipos sin compilar |

---

## Configuración

Copia el archivo de plantilla y rellena lo que necesites:

```bash
cp .env.example .env
```

| Variable | Para qué |
| --- | --- |
| `OPENAI_API_KEY` | Proveedor OpenAI |
| `ANTHROPIC_API_KEY` | Proveedor Anthropic |
| `OLLAMA_BASE_URL` | IA local (por defecto `http://localhost:11434`) |
| `OLLAMA_MODEL` | Modelo local (por defecto `llama3.1`) |
| `LMSTUDIO_BASE_URL` | IA local con LM Studio |

> ⚠️ **Nunca subas tu archivo `.env`.** El `.gitignore` ya lo excluye, pero ten
> cuidado al copiar datos sensibles en otros ficheros.
> Consulta [`.env.example`](./.env.example) para la plantilla.

---

## Estructura del proyecto

```
src/
├── main/                      # Proceso principal (Node.js)
│   ├── index.ts               # Ciclo de vida + instancia única
│   ├── window/WindowManager   # Ventana flotante transparente (RF-01)
│   ├── ipc/handlers.ts        # Canales IPC tipados
│   ├── sockets/               # Servidor WebSocket        [Sprint 2]
│   ├── ai-providers/          # OpenAI / Anthropic / Ollama [Sprint 3]
│   ├── storage/               # safeStorage (DPAPI)        [Sprint 3]
│   └── tray/                  # Bandeja del sistema       [Sprint 2]
│
├── preload/index.ts           # Firewall contextBridge → window.aurapetAPI
│
├── renderer/                  # Proceso de renderizado (React)
│   ├── components/PetAvatar/  # Mascota SVG vectorial
│   ├── stores/                # Zustand: petMood, ui, settings
│   └── styles/                # Tailwind CSS
│
└── shared/contracts.ts        # Contratos Main ↔ Renderer

tests/                         # Vitest
.github/workflows/ci.yml      # GitHub Actions
```

### Arquitectura

El proyecto sigue **Clean Architecture** con aislamiento estricto de procesos:

- **Main** — ciclo de vida, ventanas, almacenamiento seguro, sockets. Sin UI.
- **Preload** — única API expuesta al renderer, congelada vía `contextBridge`.
  `nodeIntegration` desactivado y `contextIsolation: true`.
- **Renderer** — interfaz, SVG y estado visual. Sin acceso a Node ni al sistema de archivos.

---

## Contribuir

El equipo trabaja con ramas y Pull Requests sobre `main`. **Nunca se hace push directo.**

```bash
git switch main && git pull        # Sincronizar
git switch -c feature/mi-tarea      # Rama propia desde main
# ... trabajar ...
git add . && git commit -m "feat: descripción"
git push -u origin feature/mi-tarea
```

Después abre el PR. GitHub Actions ejecutará typecheck, tests, build y auditoría
de dependencias automáticamente: si falla, el PR no se puede fusionar.

**Lee la [sección 11 del PDR](./PDR-AuraPet.md#11-protocolo-de-colaboración-entre-developers-prevención-de-conflictos)**
antes de contribuir: explica qué carpeta es de quién y cómo evitar conflictos.

---

## Licencia

MIT