# TASK_PLAN: Bienvenida — textos nuevos e ícono de donación en el encabezado

**Estado:** LISTO PARA EJECUCIÓN
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **Fuente:** `aquive-cambios.pdf`, puntos 1, 2 y 3 (revisión de la Fundación, 2026-09-10)
- **Sin ADR** — no toca ninguna regla dura, pero SÍ toca el párrafo protegido de
  `AGENTS.md` §Pantallas: "La bienvenida lleva el nombre y la frase de descripción palabra
  por palabra... la verificación de marca ya se cayó dos veces por menos." Léelo antes de
  tocar `bienvenida.tsx`.

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** ninguno — es copy y un botón, sin escritura a base de datos.
- **Archivos a modificar:**
  - `src/components/bienvenida.tsx` — labels, subtítulos y párrafo descriptivo.
  - `src/components/encabezado.tsx` — ícono de donación nuevo.
  - Los otros 4 sitios donde vive el párrafo descriptivo duplicado (ver Sección 2).
  - `README.md` (el mismo párrafo, según el comentario de `bienvenida.tsx` líneas 23-34).
- **Archivos nuevos:** ninguno.
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

**Botones de la bienvenida** (`src/components/bienvenida.tsx`, líneas ~85-115):
- Botón 1: label pasa de **"Necesito un servicio"** a **"Necesito algo"**; agrega el
  subtítulo **"Servicios y productos"** debajo (además del subtítulo existente, o
  reemplazándolo — decide en la implementación cuál lee mejor, sin perder el `href="/inicio"`
  actual).
- Botón 2: label pasa de **"Ofrezco mi trabajo"** a **"Ofrezco algo"**; mismo subtítulo
  **"Servicios y productos"** debajo. Mantén las dos variantes de subtítulo/`href` según
  `conSesion` que ya existen (línea ~101-115) — el cambio es de label y el subtítulo
  compartido, no de la lógica de sesión.

**Párrafo descriptivo** — cambia, en **los 5 sitios a la vez, en el mismo commit**, al texto
exacto que dio la Fundación:

> "Una red de personas donde quien necesita algo encuentra a quien lo ofrece."

Sitios (ubícalos con `grep -r` del texto actual — "Una red de vecinos donde quien necesita
un servicio" — antes de editar, por si el texto exacto varió):
1. `src/components/bienvenida.tsx` — el párrafo visible bajo el `<h1>`.
2. `metadata.description` (probablemente en `src/app/layout.tsx` o `src/app/page.tsx`).
3. `openGraph.description` (mismo archivo o cercano).
4. `DATOS_ESTRUCTURADOS.description` (JSON-LD, búscalo por `DATOS_ESTRUCTURADOS`).
5. `README.md`.

⚠ Si al buscar aparece un sexto sitio no listado aquí, edítalo también — la garantía es
"los 5 sitios duplicados", no "estos 5 archivos exactos"; confírmalo con `grep -rn` del
texto viejo por todo el repo antes de dar el paso por terminado.

**Ícono de donación** (`src/components/encabezado.tsx`): agrega un ícono/botón flotante
(ej. `Heart`, de `lucide-react`, mismo que ya usa la tarjeta "Dono" de `/inicio`) que
navegue a `/donaciones`, en la esquina superior derecha del encabezado global, junto al
isotipo/notificaciones. **No lo agregues a `bienvenida.tsx`** — esa pantalla no usa este
encabezado y se decidió dejarla "sin cromo" como está.

## 3. Pasos de implementación (Antigravity)

- [x] **Paso 1:** `grep -rn` del párrafo descriptivo actual en todo `src/` y `README.md`;
      lista los archivos reales encontrados antes de tocar nada.
- [x] **Paso 2:** Cambia el párrafo en los sitios encontrados, texto idéntico en los 5.
- [x] **Paso 3:** Cambia los labels y subtítulos de los dos botones en `bienvenida.tsx`.
- [x] **Paso 4:** Agrega el ícono de donación en `encabezado.tsx`, con `aria-label`
      ("Donaciones") y área táctil de 48px (`size-12`, regla de accesibilidad).

## 4. Criterios de aceptación

- La bienvenida (`/`) muestra "Necesito algo" y "Ofrezco algo" con "Servicios y productos"
  debajo de cada uno.
- El párrafo nuevo aparece idéntico en los 5 sitios — compáralos con `grep` al final.
- El ícono de donación aparece en el encabezado (no en la bienvenida) y lleva a
  `/donaciones`.
- `git diff` de `bienvenida.tsx` no toca el `href`/lógica de `conSesion` de los botones, solo
  texto.

## 5. Verificación y puerta de calidad

- [x] `npm run lint` (`bienvenida.tsx`, `encabezado.tsx` y `layout.tsx` pasan sin errores)
- [x] `npm run typecheck` (`npx tsc --noEmit` pasa 100 % limpio)
- [x] Revisar visualmente `/` con y sin sesión (dev server activo en `localhost:3737`).
- [x] Sin warnings de build (`npm run build` pasa limpio con 69 rutas generadas).
- [x] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- Si Google vuelve a rechazar la verificación de marca tras este cambio, es una consecuencia
  ya aceptada explícitamente por el usuario — no es motivo para revertir sin preguntar,
  pero repórtalo si algo lo indica durante la construcción (no hay forma de comprobarlo en
  desarrollo).
- **Corrección post-cierre, con confirmación directa de la Fundación:** el ícono NO va en el
  encabezado global — va flotante, arriba a la derecha, solo en `bienvenida.tsx` (mockup de
  la Fundación lo confirma). Se movió de `encabezado.tsx` a `bienvenida.tsx`, `absolute`
  dentro de `<main>` (que ahora es `relative`), sin depender del header que esta pantalla no
  usa. Ícono cambiado de `Heart` a `PackageOpen` (caja de recolección, no corazón — pedido
  también por el usuario tras ver el mockup). Renderiza igual con y sin sesión, porque los
  dos botones "Necesito algo"/"Ofrezco algo" tampoco dependen de la sesión.
