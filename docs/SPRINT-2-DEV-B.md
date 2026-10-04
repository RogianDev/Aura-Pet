# Sprint 2 — Dev B: animaciones, fisicas y Zustand

| | |
| --- | --- |
| **Rama** | `feature/dev-b-sprint2-animaciones-stores` |
| **Developer** | Dev B (`src/renderer/` es su zona) |
| **Alcance del sprint** | Animaciones con Framer Motion, hooks de seguimiento de cursor y stores Zustand |
| **Requisitos cubiertos** | RF-02, R-01, RNF-01, TC-PET-001 |
| **Dependencias anadidas** | Ninguna |
| **Estado** | Completo. 8 commits locales, **sin push** |

---

## 1. Que pedia el Sprint 2 para Dev B

La seccion 9 del PDR asigna a Dev B en el Sprint 2 tres cosas:

> **Dev B:** Animaciones con Framer Motion, hooks de seguimiento de cursor y Zustand stores.

En el Sprint 1 ya existian `PetAvatar` (SVG), los tres stores Zustand y un
seguimiento de cursor basico. Este sprint los convierte en piezas reutilizables
y, sobre todo, en pieces que **no rompen el limite de CPU** del proyecto.

---

## 2. El problema real que habia que resolver

El PDR recoge en su matriz de riesgos un riesgo que el codigo del Sprint 1
incumplia:

| Riesgo | Mitigacion que exige el PDR | Estado en Sprint 1 |
| --- | --- | --- |
| R-01 — carga de CPU por seguimiento del raton | Throttling con `requestAnimationFrame` | **Sin cumplir** |

En el Sprint 1, `PetAvatar` escuchaba `mousemove` y llamaba a `setCursor(...)` en
**cada evento**:

```ts
// src/renderer/components/PetAvatar/PetAvatar.tsx (Sprint 1)
window.addEventListener('mousemove', onMouseMove); // -> setCursor(x, y) en cada evento
```

Un raton de alta frecuencia genera cientos o miles de eventos por segundo. Cada
uno escribia en Zustand y provocaba un re-render del SVG entero. Eso pone en
riesgo tanto RNF-01 (CPU < 1 %) como TC-PET-001 (pupilas a 60 fps sin tirones),
porque el trabajo se hacia en el hilo de React en lugar de en el hilo de
renderizado.

Ademas, el mismo componente tenia incrustados el parpadeo y los tres
`useSpring`, de modo que nada de eso era reutilizable ni verificable.
---

## 5. Archivos modificados (5)

### 5.1 `stores/petMoodStore.ts`

| Antes | Despues |
| --- | --- |
| `mood`, `cursor` | + `isBlinking` |
| `setMood` siempre notifica | `setMood` no notifica si el animo no cambia |
| — | + `setBlinking`, `reset`, `createInitialPetMoodState()` |
| — | + `selectIsSleepy`, `selectIsAlert`, `selectCanBlink` |

El parpadeo era un `useState` dentro del componente: **no era observable** por
nadie mas. Ahora vive en el store, y por eso puede ser consumido por el
panel de chat o por el sistema de bandeja sin que la mascota lo gestione.

### 5.2 `stores/uiStore.ts`

| Antes | Despues |
| --- | --- |
| `isChatOpen`, `isSettingsOpen` independientes | + `activePanel` como fuente de verdad |
| `toggleChat`, `toggleSettings`, `closeAll` | Se conservan **con su firma original** |
| — | + `openPanel`, `closePanel` |

Mantener la API anterior evita romper a quien ya la use, que era el criterio de
la seccion 11 del PDR (cambios pequenos y compatibles).

### 5.3 `stores/settingsStore.ts`

| Antes | Despues |
| --- | --- |
| Estado local sin conectar con Main | + `hydrate()` y `persist()` |
| `DEFAULTS` privado | + `DEFAULT_SETTINGS` y `normalizeSettings()` exportados |
| — | + `isHydrated`, `setVolume` con recorte |

Antes los ajustes del renderer **nunca se comparaban con los de Main**: eran dos
listas de valores por defecto que podian divergir sin avisar.

### 5.4 `components/PetAvatar/PetAvatar.tsx`

De 99 lineas con logica reactiva incrustada a un componente que solo dibuja.
Eliminado del componente: el listener de `mousemove`, el timer de parpadeo y los
tres `useSpring`. Añadido: consumo de `MOOD_CONFIG`, `petVariants` y el latido de
la antena en alerta.

### 5.5 `App.tsx`

Monta `useCursorTracking()` en la raiz (es un listener de ventana, no de la
mascota) y llama a `settingsStore.hydrate()` al arrancar.

---

## 6. Decisiones tecnicas

### 6.1 Logica pura + hooks finos

`createCursorTracker` y `createBlinkScheduler` no saben nada de React. Los hooks
son de 20-30 lineas y solo los enganchan y desenganchan. Asi el 90 % del
comportamiento —que es donde estan los bugs— es verificable sin DOM.

### 6.2 `MotionValue` en lugar de estado de React

El cursor se publica por dos vias a proposito:

1. `cursorXMotion` / `cursorYMotion` (Framer Motion) mueven el SVG **sin
   re-renderizar React**. Es lo que sostiene TC-PET-001.
2. `petMoodStore.cursor` mantiene la posicion como estado observable y alineada
   con `PetState.cursor` del contrato.

Solo la primera mueve la mascota; la segunda existe para que el resto de la app
pueda consultar "donde esta el raton".

### 6.3 Coalescencia: el detalle que importa

```ts
tracker.handleMove({ clientX: 100, clientY: 100 });
tracker.handleMove({ clientX: 120, clientY: 110 });
tracker.handleMove({ clientX: 130, clientY: 120 });
// -> se pide 1 frame; se emite solo la ultima posicion
```

Con un raton de 1000 Hz, el Sprint 1 hacia 1000 escrituras por segundo. Ahora se
hace como maximo **una por frame** (60/segundo), y se descartan las intermedias
porque el ojo humano no percibe una posicion del raton que existio 2 ms.

### 6.4 Sin dependencias nuevas

Testear hooks de React exigiria `jsdom` + `@testing-library/react`, es decir
tocar `package.json` y el lockfile justo cuando Dev A esta entregando el
servidor WebSockets. La seccion 11.2 del PDR pide que `package.json` tenga un
unico dueno por PR.

Separando la logica en modulos puros, hay **78 tests sin anadir ninguna
dependencia**.
`framer-motion` y `zustand` ya estaban declarados desde el Sprint 1.

### 6.5 Detalles de tipado que dejo documentados en el codigo

- **Una transicion por variante, no por propiedad.** En framer-motion 11 el tipo
  `Variants` trata cada clave como una etiqueta de variante, asi que
  `transition: { y: {...}, rotate: {...} }` no compila. Se usa una transicion
  por variante, que es la forma soportada y tipada.
- **`bob()` sin tipo de retorno declarado.** `Transition` es un *interface* y las
  interfaces no tienen indice implicito, por lo que anotarla impide asignarla a
  `Variant`. Un literal de objeto si lo tiene.

---

## 7. Mapa de commits

Cada commit compila, pasa los tests y construye por separado, para que un
`git bisect` nunca deje el arbol en rojo.

| # | Commit | Archivos | Que resuelve |
| --- | --- | --- | --- |
| 1 | `feat(dev-b): extender stores Zustand de animo, cursor, paneles y ajustes` | 3 modificados + 1 nuevo | Estado base para las animaciones |
| 2 | `feat(dev-b): anadir hooks de cursor, parpadeo y fisicas con throttle rAF` | 8 nuevos | **Mitigacion de R-01** |
| 3 | `refactor(dev-b): migrar PetAvatar a los hooks de cursor, parpadeo y fisicas` | 1 modificado | Saca la logica del componente |
| 4 | `feat(dev-b): definir variantes de animacion por animo con Framer Motion` | 1 nuevo + 1 modificado | Animaciones diferenciadas por animo |
| 5 | `feat(dev-b): montar hooks y sincronizar ajustes desde Main en App` | 1 modificado | Conecta todo lo anterior |
| 6 | `test(dev-b): cubrir trackers de cursor, parpadeo y stores con Vitest` | 6 nuevos | 78 tests |
| 7 | `docs(dev-b): documentar Sprint 2 - animaciones, hooks y stores Zustand` | 1 nuevo | Este documento |
| 8 | `docs(dev-b): actualizar README con la estructura de hooks del renderer` | 1 modificado | Estructura visible en el README |

---

## 8. Como verificarlo

### 8.1 Gates automaticos (los mismos que ejecuta el CI)

```bash
npm run typecheck   # tsc --noEmit (renderer + preload + shared)
npm run test        # vitest run
npm run build       # tsc main + vite build
```

Estado en el momento de abrir el PR: **los tres en verde**.

### 8.2 Comprobacion manual

```bash
npm run dev
```

Que deberia verse:

| Accion | Resultado esperado |
| --- | --- |
| Mover el raton sobre la ventana | Las pupilas le siguen con cierto retardo elastico |
| Rapido y corto (vibracion del raton) | La mascota sigue la posicion **suave**, no a saltos |
| Dejar el raton quieto | La mascota no se agita: el umbral de 1 px evita el tembleque |
| Esperar unos segundos | Parpadea cada pocos segundos, a ritmo variable |
| Esperar con el animo `sleepy` | Los ojos se mantienen cerrados y deja de parpadear |
| Pasar el raton por encima | Un leve aumento de tamano al hacer hover |

El animo todavia no se puede cambiar a mano porque no hay interfaz para ello: se
cambia cuando llegue el puente con el servidor WebSocket (ver 9.3).

---

## 9. Pendientes y deuda detectada

Nada de esto bloquea el PR; queda listado para que el equipo lo decida.

### 9.1 `tests/` no entra en el typecheck del CI

`tsconfig.json` incluye `src/renderer`, `src/preload` y `src/shared`, pero **no
`tests/`**. Vitest transpila con esbuild y **no comprueba tipos**, asi que un
error de tipado en un test no rompe el CI.

Se detecto porque al verificar localmente con una config temporal aparecio un
`TS6133` real (una variable destructurada y sin usar). Esa config **no se ha
commitado** a proposito, porque tocaria `package.json`.

**Propuesta para el equipo:** un `tsconfig.test.json` de tres lineas y un script
`typecheck:tests`. Quien mergee `package.json` primero lo anade.

### 9.2 `package-lock.json` va por detras de `package.json`

`npm install` reescribe la cabecera del lockfile porque el lock dice
`"version": "1.2.0"` y el `package.json` dice `1.3.0`. No hay cambios de
dependencias, solo metadatos.

Ese cambio se ha **revertido a proposito** para no tocar el lockfile (seccion
11.2). Quien tenga cuenta de `package.json` en este sprint lo actualiza con un
commit propio.

### 9.3 Falta el puente con los sockets

Este sprint deja la mascota preparada para reaccionar (animo `alert`, latido de
la antena), pero **no hay ningun canal que le avise**. Cuando Dev A entregue el
servidor WebSocket hara falta:

1. Un canal de suscripcion en `src/shared/contracts.ts` (por ejemplo
   `SOCKET_ON_EVENT`) mas su exposicion en el preload.
2. Un `useSocketEvents()` en `src/renderer/hooks/` que llame a
   `usePetMoodStore.setMood('alert')` al recibir un evento de CLI.

Dev B deja el store y los hooks listos; el canal es cosa de Dev A porque el
contrato compartido es el archivo de mayor riesgo (seccion 11.3).

### 9.4 `ChatPanel` y `SettingsPanel` siguen sin existir

`uiStore` queda preparado para ellos (`activePanel`, `openPanel`, `closePanel`),
pero los componentes pertenecen al Sprint 3 de Dev B ("panel de configuracion
UI"), asi que **no se han creado todavia**.

---

## 10. Nota de coordinacion para Dev A

Este PR **solo toca `src/renderer/`** mas el `README.md`. No se ha modificado:

- `src/main/`
- `src/preload/`
- `src/shared/contracts.ts`
- `package.json`
- `package-lock.json`

Es decir, **el PR se puede mergear sin conflictos** con el trabajo de sockets.

Revisar con lupa, si eso si:

- **`README.md`** es compartido: se anadio `hooks/`, `utils/` y `config/` a la
  seccion de estructura, y se menciona la suite de tests. Si Dev A lo esta
  tocando, avisar antes de mergear.

---

## 11. Resumen para la revision

**Lo que hay que mirar de verdad en el code review:**

1. `utils/cursorTracker.ts` — es la pieza que cumple R-01. Conviene confirmar que
   la coalescencia y el umbral son lo que se espera.
2. `config/moodConfig.ts` — los numeros de fisica son, en principio, la parte
   subjetiva de este sprint. Ajustarlos es trivial una vez se vean en pantalla.
3. `petVariants.ts` — las dos decisiones de tipado que no son evidentes estan
   comentadas en el propio archivo.

**Lo que no hay que mirar con lupa:** los tres stores, que son casi puro
mantenimiento explicito.

---

*Documento escrito por Dev B durante el Sprint 2. Rama
`feature/dev-b-sprint2-animaciones-stores`. Pendiente de `git push` y apertura
de PR en cuanto haya margen de escritura al repositorio.*
Ambas decisiones estan explicadas en el propio `petVariants.ts` para que el
proximo no las vuelva a pelear con el compilador.

---

## 3. Archivos creados (9)

Todos dentro de `src/renderer/`, que es la zona exclusiva de Dev B.

| Archivo | Tipo | Que resuelve |
| --- | --- | --- |
| `utils/math.ts` | puro | `clamp` y `clampUnit`, sin dependencias de React |
| `utils/cursorTracker.ts` | puro | **Mitigacion de R-01**: coalescencia con `requestAnimationFrame`, umbral de movimiento, limpieza segura |
| `utils/blinkScheduler.ts` | puro | Parpadeo con ventana aleatoria, reloj y azar inyectables |
| `config/moodConfig.ts` | datos | Aspecto y fisicas de los 5 animos en un solo sitio |
| `motion/cursorMotion.ts` | estado | `MotionValue` compartidos del cursor (movimiento sin re-render) |
| `hooks/useCursorTracking.ts` | hook | Engancha y desengancha el tracker a la ventana |
| `hooks/useBlink.ts` | hook | Publica el parpadeo en `petMoodStore.isBlinking` |
| `hooks/usePetPhysics.ts` | hook | Los tres resortes: pupilas y parpados |
| `hooks/index.ts` | barrel | Puntos de entrada publicos de `hooks/` |
| `components/PetAvatar/petVariants.ts` | datos | Variantes de movimiento por animo |

> `utils/` y `config/` no estaban en el arbol del PDR. Son deliberados: son lo
> que permite verificar el comportamiento en entorno `node` sin dependencias
> nuevas (ver seccion 5.4).

## 4. Tests creados (6 ficheros, 78 tests)

| Fichero | Tests | Cubre |
| --- | --- | --- |
| `tests/renderer/math.test.ts` | 7 | Recorte de valores, `NaN`, intervalo invertido |
| `tests/renderer/cursorTracker.test.ts` | 15 | Normalizacion, coalescencia, umbral, `destroy()`, `flush()` |
| `tests/renderer/blinkScheduler.test.ts` | 16 | Orden de los eventos, ritmo, `shouldBlink`, `blinkNow` |
| `tests/renderer/petMoodStore.test.ts` | 13 | Setters sin notificacion redundante, selectores derivados |
| `tests/renderer/uiStore.test.ts` | 13 | Exclusion mutua de paneles, consistencia con `activePanel` |
| `tests/renderer/settingsStore.test.ts` | 14 | `hydrate`, `persist`, saneamiento y fallos de Main |

**Total del repositorio: 84 tests en 7 ficheros** (6 preexistentes de Dev A).