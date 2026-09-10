# TASK_PLAN: Menú hamburguesa — "Bienvenida" pasa a llamarse "Inicio"

**Estado:** LISTO PARA EJECUCIÓN
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **Fuente:** `aquive-cambios.pdf`, página 7 (revisión de la Fundación, 2026-09-10)
- **Sin ADR** — es rótulo, no cambia el destino ni el mecanismo del ADR 0018. Ver aviso
  abajo sobre el riesgo aceptado.

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** ninguno.
- **Archivos a modificar:** `src/components/menu-sombrilla.tsx`.
- **Archivos nuevos:** ninguno.
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

En `ENLACES_MENU` (líneas ~23-30), la primera entrada cambia:

```
{ etiqueta: 'Bienvenida', href: '/', icono: Sparkles }
```
pasa a
```
{ etiqueta: 'Inicio', href: '/', icono: Sparkles }
```

**El `href` NO cambia — sigue siendo `/`.** Solo el texto visible. El ícono (`Sparkles`)
tampoco cambia.

⚠ **Riesgo aceptado, no a resolver en este plan:** la barra inferior ya tiene una celda
llamada "Inicio" que lleva a `/inicio` (pantalla distinta). Con este cambio hay dos textos
"Inicio" en la interfaz, cada uno a un sitio distinto — el usuario del proyecto ya lo sabe y
decidió seguir adelante así. No inventes una solución al respecto (renombrar la otra celda,
agregar un subtítulo, etc.) sin que te lo pidan aparte.

## 3. Pasos de implementación (Antigravity)

- [x] **Paso 1:** Cambia la etiqueta de la primera entrada de `ENLACES_MENU` en
      `menu-sombrilla.tsx`, de `'Bienvenida'` a `'Inicio'`.

## 4. Criterios de aceptación

- El menú hamburguesa (isotipo) muestra "Inicio" como primera fila, llevando a `/`.
- Ningún otro texto ni destino del menú cambia.

## 5. Verificación y puerta de calidad

- [x] `npm run lint` (`menu-sombrilla.tsx` pasa sin errores ni warnings)
- [x] `npm run typecheck` (`npx tsc --noEmit` pasa 100 % limpio)
- [x] Abrir el menú y confirmar visualmente (corriendo en dev server `http://localhost:3737`).
- [x] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- Ninguno — es el cambio más chico de todo el paquete.
