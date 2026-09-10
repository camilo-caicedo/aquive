# TASK_PLAN: Pie de página — fuera el bloque de líneas de emergencia

**Estado:** LISTO PARA EJECUCIÓN
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **Fuente:** `aquive-cambios.pdf`, punto 3 de la página 3 (revisión de la Fundación,
  2026-09-10)
- **Sin ADR** — no toca ninguna regla dura ni pantalla del prototipo.

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** ninguno.
- **Archivos a modificar:** `src/components/pie-de-pagina.tsx`.
- **Archivos nuevos:** ninguno.
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

Quita el array `EMERGENCIAS` (líneas ~5-9) y el bloque que lo renderiza como enlaces `tel:`
(líneas ~19-31), incluida la frase "Esta plataforma no reemplaza a las autoridades" que
está pegada a ese bloque (línea ~34) **si** la frase existe solo para presentar el bloque de
emergencias — revísalo al leer el archivo, y si esa frase tiene sentido propio (independiente
del bloque de teléfonos), consérvala.

**No toques:**
- El párrafo de responsabilidad de la fundación (líneas ~37-55, marcado como sensible en el
  propio comentario del archivo).
- La navegación de enlaces del footer (Preguntas frecuentes, Contacto, Quiénes somos, PQR y
  habeas data, Aviso de privacidad, Términos de uso, Cómo cuidarte, Datos abiertos) — **salvo**
  que ya estés ejecutando también `Planes/datos-abiertos-retirar-pantalla.md`, en cuyo caso
  coordina con ese plan para no duplicar el quite del enlace a `/datos`.

El aviso rojo "Si hay riesgo para alguien ahora / Llamar al 123" de `/ayuda` es una sección
**distinta**, en un archivo distinto (`app/ayuda/page.tsx`) — no lo toques aquí, lo cubre
`Planes/faq-preguntas-y-aviso-amarillo.md`.

## 3. Pasos de implementación (Antigravity)

- [x] **Paso 1:** Lee `pie-de-pagina.tsx` completo, confirma qué está pegado al bloque de
      emergencias y qué es independiente.
- [x] **Paso 2:** Quita el array `EMERGENCIAS` y su render.
- [x] **Paso 3:** Verifica que el resto del footer (navegación, párrafo de responsabilidad)
      sigue intacto y bien formado (sin `<div>` huérfano donde vivían las emergencias).

## 4. Criterios de aceptación

- El pie de página ya no muestra Emergencias 123 / Cruz Roja 132 / Defensa Civil 144.
- El resto del pie de página (navegación y párrafo de responsabilidad) se ve igual que antes.

## 5. Verificación y puerta de calidad

- [x] `npm run lint` (el componente `pie-de-pagina.tsx` pasa limpio sin errores ni warnings)
- [x] `npm run typecheck` (`npx tsc --noEmit` pasa 100 % limpio)
- [x] Revisar visualmente una pantalla donde `PieDePagina` se monta (confirma primero dónde
      es visible: está gateado por `data-pie-de-pagina` + CSS, así que revisa `globals.css`
      para saber en qué pantallas aparece hoy).
- [x] Sin warnings de build (`npm run build` exitoso con 70/70 rutas generadas).
- [x] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- **Corrección del Arquitecto en la auditoría:** Antigravity quitó también "Esta plataforma
  no reemplaza a las autoridades" junto con el bloque de teléfonos, dejando el comentario de
  arriba ("Lo que NO cambió: que no reemplaza a las autoridades...") contradicho por el
  propio código. El plan pedía conservar esa frase si tenía sentido propio — lo tiene, no
  depende de los números de emergencia. Restauré la frase como párrafo aparte (con su
  `mt-4`) antes de aprobar; no fue necesario tocar nada más.
