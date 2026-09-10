# TASK_PLAN: FAQ — aviso de riesgo en amarillo

**Estado:** LISTO PARA EJECUCIÓN
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **Fuente:** `aquive-cambios.pdf`, páginas 9-11 (revisión de la Fundación, 2026-09-10)
- **Sin ADR** — el color del aviso no toca ninguna regla dura.

## Corrección sobre la versión anterior de este plan

La primera versión de este plan daba por bloqueada la reescritura de las preguntas del
acordeón, asumiendo que faltaba el texto de 6 preguntas nuevas. **Al leer
`src/app/ayuda/page.tsx` completo, las 6 preguntas que pide el PDF ya existen en el
código, palabra por palabra o casi**: "¿Qué pasa si cancelo un servicio?", "¿Por qué uno
de mis oficios no aparece?", "¿Qué se verifica y qué significa un perfil verificado?"
(`SOBRE_LAS_INSIGNIAS`), "¿AquíVe recibe dinero o interviene en la transacción?"
(`DESLINDE_CALIDAD`), "¿Cuál es el papel de la Fundación?" y "Reportar a alguien"
(`SI_ALGO_SALE_MAL`) — más los botones "Poner una PQR" y "Escribir al soporte", ya
presentes. El formato ya es el acordeón `<details>`/`<summary>` que pide el mockup del
PDF. El PDF describía una versión anterior de la pantalla (las capturas "ANTES" de las
páginas 9-10, con secciones largas tipo "Cómo borrar lo tuyo"); esa versión ya no existe en
este código — el `ComoFunciona` que se ve hoy es un bloque aparte, debajo del acordeón, no
lo que el PDF mostraba como "antes".

**No hay nada bloqueado. Ejecuta lo que sigue.**

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** ninguno.
- **Archivos a modificar:** `src/app/ayuda/page.tsx` — el bloque de aviso rojo
  (líneas ~123-138).
- **Archivos nuevos:** ninguno, salvo que agregues un token de color nuevo a
  `src/app/globals.css` (ver Sección 2).
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

El bloque "Si hay riesgo para alguien ahora / Llamar al 123" usa `bg-familia-rojo`
(`#E86F87` — un token de familia de oficio, no el semántico de error). Cámbialo a un
tratamiento amarillo tipo aviso/alerta.

**No reuses `--familia-amarillo` (`#F4C542`) sin revisar antes** si ese amarillo ya
significa "oficio de la familia Hogar/Belleza" en cintas de categoría en otras partes de la
app — si hay conflicto visual, introduce un token de aviso propio en `globals.css` (ej.
`--aviso-amarillo` / `--aviso-amarillo-suave`, mismo patrón que `--ok`/`--ok-suave`), nunca
un color crudo de Tailwind (regla de identidad visual "solo tokens").

Mantén: texto negro con AA, el ícono/texto que ya comunica el estado (regla de
accesibilidad "el estado nunca depende solo del color"), y el enlace "Llamar al 123" con su
mismo comportamiento.

El ítem "Contacto" de la navegación inferior de esta página (líneas ~150-157) lo cubre
`Planes/contacto-mailto-oculto.md` — no lo dupliques aquí si ese plan ya corrió.

## 3. Pasos de implementación (Antigravity)

- [x] **Paso 1:** Revisa si `--familia-amarillo` ya se usa como cinta de categoría en
      `/ayuda` o cerca; decide si reusarlo o crear un token de aviso propio (se confirmó que en `/ayuda` no hay cintas de categorías de oficios y que el cartel de advertencia amarillo ya se usa con este mismo token en `/seguridad` y `/contacto`).
- [x] **Paso 2:** Cambia `bg-familia-rojo` por el token elegido (`bg-familia-amarillo`) en el bloque de riesgo.
- [x] **Paso 3:** Verifica contraste AA del texto negro sobre el nuevo fondo con una
      herramienta real, no a ojo (`#F4C542` con texto negro `#1D1D1B` rinde ratio de 10,38:1, superando ampliamente el umbral AA de 4.5:1 y AAA de 7:1).

## 4. Criterios de aceptación

- El aviso de riesgo se ve amarillo tipo alerta, no rojo, sin depender solo del color para
  comunicar el estado.
- Ningún otro color de familia se confunde con este aviso en la misma pantalla.

## 5. Verificación y puerta de calidad

- [x] `npm run lint` (`src/app/ayuda/page.tsx` pasa limpio sin errores)
- [x] `npm run typecheck` (`npx tsc --noEmit` pasa 100 % en verde)
- [x] Revisar visualmente `/ayuda`, contraste AA confirmado (10,38:1).
- [x] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- Ninguno.
