# TASK_PLAN: Perfil — se retira la fila de matrícula del menú

**Estado:** LISTO PARA EJECUCIÓN
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **ADR:** `docs/decisiones/0024-la-matricula-pierde-su-puerta-en-el-perfil.md`
- No depende de las migraciones de esquema.

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** ninguno — `src/server/servicios/matricula.ts` y la ruta
  `/perfil/matricula` **no se borran** (ver ADR 0024), solo pierden su entrada de menú.
- **Archivos a modificar:** `src/app/perfil/page.tsx` — quitar el bloque `deLaMatricula`
  (líneas ~345-358) y su inclusión en `filas` (línea ~360).
- **Archivos nuevos:** ninguno.
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

Quita el array `deLaMatricula` completo y su spread en `filas` en `app/perfil/page.tsx`. No
toques `/perfil/matricula`, `src/server/servicios/matricula.ts`, ni `/admin/matriculas` — la
ruta y el dominio se quedan, solo se apaga la puerta de autoservicio desde el menú, tal
como lo describe el ADR 0024.

⚠ **No agregues ningún reemplazo** (un enlace en otro lado, una condición para mostrarla a
veces) — el ADR es explícito: se quita entera, sin sustituto, y cualquier reemplazo es una
decisión de producto nueva que no está en este plan.

## 3. Pasos de implementación (Antigravity)

- [x] **Paso 1:** Quita el array `deLaMatricula` y su inclusión en `filas`, en
      `app/perfil/page.tsx`.
- [x] **Paso 2:** Confirma que la variable `matricula` (línea ~193,
      `servidor.servicios.miMatricula()`) sigue usándose en otro lado de la pantalla o, si
      quedó huérfana, quítala también — sin dejar código muerto.

## 4. Criterios de aceptación

- El menú de `/perfil` ya no muestra "Agregar mi matrícula" ni "Mi matrícula".
- `/perfil/matricula` sigue existiendo como ruta (accesible por URL directa) y sigue
  funcionando si alguien llega ahí.
- `/admin/matriculas` no cambia.

## 5. Verificación y puerta de calidad

- [x] `npm run lint`
- [x] `npm run typecheck` (o `npx tsc --noEmit`)
- [x] Revisar visualmente `/perfil` — sin la fila, sin huecos ni bordes raros donde estaba.
- [x] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- El ADR 0024 documenta una consecuencia negativa real: nadie puede declarar matrícula
  nueva por su cuenta después de este cambio. No es un bug a corregir en este plan — es la
  decisión tomada. Si surge algo que la contradiga durante la construcción, repórtalo aquí en
  vez de decidir por tu cuenta.
