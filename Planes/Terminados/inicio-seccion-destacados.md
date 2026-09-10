# TASK_PLAN: `/inicio` — sección "Destacados" debajo de categorías

**Estado:** LISTO PARA EJECUCIÓN
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **ADR:** `docs/decisiones/0021-destacados-en-inicio.md`
- No depende de las migraciones de esquema (paso 1) — usa datos ya existentes.

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** `src/server/servicios/consultas.ts` — probablemente necesitas una
  función nueva (ej. `destacados(db, limite)`) o extender `inicio()`/la que ya alimenta
  `/inicio`, reusando `proveedoresPublicos` ordenado por `serviciosConfirmados` desc.
- **Archivos a modificar:**
  - `src/contrato/servicios.ts` — agrega el procedimiento o el campo de salida que
    corresponda (ver Sección 2).
  - `src/server/servicios/consultas.ts` — la consulta.
  - `src/components/inicio.tsx` — la sección nueva en la UI.
- **Archivos nuevos:** posible componente `src/components/seccion-destacados.tsx` si la
  tarjeta que se usa no es la misma `TarjetaProveedor` de `/directorio` (evalúa reusar esa
  antes de crear una nueva — ver regla de "no dupliques lo que ya existe").
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

**Consulta:** top 6 filas de `proveedoresPublicos`, ordenadas por `serviciosConfirmados`
desc (empate: cualquier criterio estable, ej. `creadoAt` desc). Misma vista que ya usa
`ficha()`/`directorio()` — no crear tabla ni caché nueva.

**Contrato:** decide si esto va como un campo nuevo en el procedimiento que ya alimenta
`/inicio` (si existe uno — revisa si `/inicio` ya llama algún procedimiento del contrato o
si hoy solo pinta categorías estáticas) o como un procedimiento nuevo
`servicios.destacados`. Sigue el patrón `oc.output(z.array(EnListado))` o un subconjunto más
liviano si `EnListado` trae más de lo que la tarjeta de "Destacados" necesita mostrar.

**UI:** sección "Destacados" en `src/components/inicio.tsx`, **debajo** de la grilla de
categorías (que ya está ahí, líneas ~70-96). Reusa `TarjetaProveedor`
(`src/components/tarjeta-proveedor.tsx`) si el formato encaja — evita reinventar la tarjeta.
Si la lista viene vacía (municipio nuevo sin nadie destacado todavía), **no muestres la
sección** — nada de "no hay destacados todavía" ocupando espacio sin necesidad (regla de
interfaz 1: primer pantallazo con dato real).

## 3. Pasos de implementación (Antigravity)

- [x] **Paso 1 [Contrato]:** agrega el procedimiento/campo de destacados a
      `src/contrato/servicios.ts`.
- [x] **Paso 2 [Dominio]:** implementa la consulta en `src/server/servicios/consultas.ts`,
      reusando `proveedoresPublicos`.
- [x] **Paso 3 [Procedimiento oRPC]:** conecta el procedimiento en `src/orpc/servidor.ts`.
- [x] **Paso 4 [UI]:** agrega la sección "Destacados" en `inicio.tsx`, debajo de categorías,
      reusando `TarjetaProveedor` si aplica.

## 4. Criterios de aceptación

- `/inicio` muestra, debajo de las categorías, hasta 6 prestadores ordenados por servicios
  confirmados.
- La sección no aparece si no hay ningún prestador público en el municipio/consulta.
- Ningún oficio de riesgo alto sin respaldo aparece ahí (heredado automáticamente de
  `proveedoresPublicos`, pero confírmalo).

## 5. Verificación y puerta de calidad

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] Probar `/inicio` con datos de prueba, y también con un municipio sin nadie (la sección
      no debe aparecer).
- [x] Sin warnings de build.
- [x] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- **El criterio de "destacado" (volumen de servicios confirmados) es una propuesta del
  arquitecto, no una confirmación de la Fundación** — ver ADR 0021. Si el usuario pide
  cambiarlo después de ver el resultado, es una iteración sobre este mismo plan, no un
  fallo de implementación.
