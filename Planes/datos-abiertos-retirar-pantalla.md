# TASK_PLAN: Se retira la pantalla «Datos abiertos»

**Estado:** LISTO PARA EJECUCIÓN
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **ADR:** `docs/decisiones/0025-se-retira-datos-abiertos.md`
- **Regla / ADR que lo respalda:** `AGENTS.md` §Pantallas, ya actualizado (la fila
  "Información" ya no lista "Datos abiertos").

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** revisar `src/server/` por si hay una consulta dedicada a esta
  pantalla (ej. `datosAbiertos` o similar en algún contrato); si existe y no la usa nada
  más, se retira también.
- **Archivos a modificar:**
  - `src/components/menu-sombrilla.tsx` — quitar la entrada "Datos abiertos" de
    `ENLACES_MENU`.
  - `src/components/pie-de-pagina.tsx` — quitar el enlace "Datos abiertos" de la navegación
    del footer.
  - Cualquier otro lugar que enlace a `/datos` — buscar con `grep -rn "'/datos'"` y
    `grep -rn '"/datos"'` en `src/`.
- **Archivos a borrar:** `src/app/datos/` entero (página y lo que le pertenezca solo a
  ella).
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

Nada de dominio o contrato se retira a menos que solo lo use esta pantalla — antes de
borrar cualquier procedimiento o consulta del contrato, confirma que `/datos` es su único
consumidor.

**No toques** `components/aviso-pruebas.tsx` (el banner "Solo para pruebas...") — es global,
no específico de esta pantalla, y el usuario confirmó que no es lo que pidió quitar.

## 3. Pasos de implementación (Antigravity)

- [ ] **Paso 1:** `grep -rn "/datos"` en todo `src/` para listar cada referencia.
- [ ] **Paso 2:** Quitar la entrada del menú hamburguesa y del pie de página.
- [ ] **Paso 3:** Borrar `src/app/datos/`.
- [ ] **Paso 4:** Si algún procedimiento de `src/contrato/`/`src/server/` era exclusivo de
      esta pantalla, retirarlo también — documentar en "Notas y bloqueos" qué se retiró.
- [ ] **Paso 5:** Confirmar que no queda ningún enlace roto (build sin warnings de rutas
      faltantes).

## 4. Criterios de aceptación

- `/datos` ya no existe como ruta (404 esperado si se visita directamente).
- Ningún menú ni pie de página enlaza a `/datos`.
- El banner "Solo para pruebas..." sigue funcionando igual en todas las demás pantallas.

## 5. Verificación y puerta de calidad

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build` (para confirmar que no queda ninguna ruta rota referenciada
      estáticamente).
- [ ] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- Ninguno conocido antes de empezar — reportar aquí si aparece un consumidor inesperado del
  contrato de datos abiertos.
