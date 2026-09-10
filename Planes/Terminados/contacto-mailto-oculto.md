# TASK_PLAN: Contacto — el correo del equipo deja de imprimirse como texto visible

**Estado:** LISTO PARA EJECUCIÓN
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **Fuente:** `aquive-cambios.pdf`, páginas 9-10 y 12 (revisión de la Fundación,
  2026-09-10)
- **Sin ADR.**
- **Decisión ya tomada con el usuario:** `mailto:` simple, sin formulario propio — la
  dirección sigue en el `href` (inevitable con `mailto:`), pero no se imprime como texto
  visible en la pantalla.

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** ninguno.
- **Archivos a modificar:**
  - `src/app/contacto/page.tsx` — fila "Correo" (y revisar la fila "Habeas data", que
    comparte el mismo buzón).
  - `src/app/ayuda/page.tsx` — el ítem de navegación "Contacto" que hoy enlaza a `/contacto`.
- **Archivos nuevos:** opcional — si el mismo patrón de botón se repite en los dos sitios,
  considera extraer un componente chico compartido (ej.
  `src/components/enlace-correo-equipo.tsx`) en vez de duplicar el JSX. Sigue el principio
  del proyecto: no dupliques lo que se puede reusar.
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

**`/contacto` (`Hablemos`):** la fila "Correo" hoy muestra
`gerencia@nodosocial.org` como texto del enlace (`f.valor`, con `href:
mailto:${CORREO_CONTACTO}`). Cambia el texto visible por algo como **"Escríbenos al
equipo"** — el `mailto:` en el `href` se queda igual (es inevitable, y es lo que ya se
confirmó como aceptable). Al hacer clic, sigue abriendo el cliente de correo del usuario tal
como hoy.

Revisa la fila "Habeas data" (mismo buzón, `gerencia@nodosocial.org`, con su propio texto
explicativo): decide si también deja de imprimir la dirección o si su propósito legal
(mínimo legal 3) justifica mantenerla más explícita — si tienes dudas, dejarla como está es
la opción segura; el PDF no la menciona explícitamente.

**`/ayuda`:** el ítem de navegación "Contacto" (que hoy es un `<Link href="/contacto">`)
se retira como enlace a otra pantalla, y se reemplaza por el mismo patrón de botón/enlace
`mailto:` directo, con texto **"Escríbenos al equipo"**, sin pasar por `/contacto`.

⚠ **No borres la pantalla `/contacto` entera** — solo cambia cómo se ve la fila del correo.
`/contacto` sigue siendo una pantalla del prototipo (`AGENTS.md` §Pantallas, grupo
Información).

## 3. Pasos de implementación (Antigravity)

- [x] **Paso 1:** Cambia el texto visible de la fila "Correo" en `app/contacto/page.tsx` de
      la dirección a "Escríbenos al equipo", conservando el `href="mailto:..."`.
- [x] **Paso 2:** Decide y aplica el mismo criterio a la fila "Habeas data" (conservada explícita conforme a la recomendación del blueprint por su carácter legal de canal formal).
- [x] **Paso 3:** En `app/ayuda/page.tsx`, reemplaza el `<Link href="/contacto">Contacto</Link>`
      por un enlace `mailto:` directo con el mismo texto "Escríbenos al equipo".
- [x] **Paso 4 (opcional):** Patrón simple y directo en JSX sin crear componentes adicionales no solicitados.

## 4. Criterios de aceptación

- En ninguna de las dos pantallas aparece `gerencia@nodosocial.org` como texto plano visible.
- El botón/enlace sigue abriendo el cliente de correo del usuario (`mailto:` funcional).
- `/contacto` sigue existiendo como pantalla.

## 5. Verificación y puerta de calidad

- [x] `npm run lint` (`app/contacto/page.tsx` y `app/ayuda/page.tsx` pasan limpios)
- [x] `npm run typecheck` (`npx tsc --noEmit` pasa 100 % limpio)
- [x] Revisar visualmente `/contacto` y `/ayuda` (servidor de desarrollo activo en `localhost:3737`).
- [x] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- El correo sigue siendo técnicamente visible en el código fuente / al inspeccionar el
  enlace — eso ya se aceptó como parte de usar `mailto:` en vez de un formulario propio con
  backend de envío.
- **Corrección del Arquitecto en la auditoría:** la Sección 4 decía "en ninguna de las dos
  pantallas aparece la dirección como texto plano", pero la Sección 2 del mismo plan
  autorizaba dejar la fila "Habeas data" explícita por ser canal legal. Antigravity siguió
  correctamente esa segunda instrucción (la más específica) y lo documentó; el criterio de
  aceptación de la Sección 4 era demasiado absoluto — imprecisión del plan, no del
  constructor. `/contacto` sigue mostrando la dirección en "Habeas data", a propósito.
