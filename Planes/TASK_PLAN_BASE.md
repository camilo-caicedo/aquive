# TASK_PLAN: [Título de la tarea]

**Estado:** [LISTO PARA EJECUCIÓN | EN CURSO | LISTO PARA AUDITORÍA | BLOQUEADO]
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **Regla / ADR que lo respalda:** [sección de `AGENTS.md`, o `docs/decisiones/00NN-*.md`]
- **Pantalla del prototipo (si aplica):** [`docs/marca/AquiVe-Flujo.dc.html`, pantalla N]

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** [`src/server/<dominio>/`]
- **Archivos a modificar:** [rutas exactas]
- **Archivos nuevos:** [rutas exactas]
- **Dependencias nuevas:** [librerías con versión exacta, o "ninguna"]

## 2. Blueprint arquitectónico y contratos

- **Panorama conceptual:** [flujo de datos, cambios de estado, reglas de negocio]
- **Contratos:** [procedimiento oRPC, esquema Zod, tipos de Drizzle]
- **Seguridad y autorización:** [quién puede llamarlo, qué valida el servidor]
- **Mínimo legal y reglas de producto tocadas:** [autorización explícita, borrado real,
  filtro de contacto del chat, moderación de imágenes, verificación manual, o "N/A"]

## 3. Pasos de implementación (Antigravity)

- [ ] **Paso 1 [Esquema/migración, si aplica]:** ...
- [ ] **Paso 2 [Dominio y caso de uso — `src/server/<dominio>/`]:** ...
- [ ] **Paso 3 [Procedimiento oRPC / Server Component / UI]:** ...
- [ ] **Paso 4 [Integración y verificación]:** ...

## 4. Criterios de aceptación

[Lista concreta y verificable de qué tiene que pasar para dar la tarea por lista.]

## 5. Verificación y puerta de calidad

- [ ] [comando exacto, p. ej. `npm run lint`, `npm run typecheck`, `npm test`]
- [ ] Reglas de interfaz de `AGENTS.md` §"Reglas de interfaz" respetadas, si toca UI.
- [ ] Sin warnings de build.
- [ ] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- [Cualquier hallazgo o decisión reportada por Antigravity durante la construcción]
