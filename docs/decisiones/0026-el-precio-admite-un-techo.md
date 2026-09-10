# ADR 0026 · El precio admite un techo opcional, además del piso

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Decide:** responsable del proyecto, a partir de revisión de la Fundación Nodo Social
- **Reemplaza:** ajusta la regla de producto 1 de `AGENTS.md`
- **Fuente:** `aquive-cambios.pdf`, revisión de la Fundación, 2026-09-10

## Contexto

La regla de producto 1 fija el precio como **modo** + un único valor «desde» + unidad, y
`src/lib/servicios.ts:precioLegible` lo declara a propósito: «el proveedor declaró un piso,
no una tarifa cerrada». No existe hoy ningún campo de techo en `proveedor_oficios` ni en el
contrato.

La Fundación pide un campo «hasta $___» junto al «desde $___» ya existente, en el formulario
de oficios y visible en la ficha y el listado.

## Decisión

Se agrega `precio_hasta` a `proveedor_oficios`: numérico, **opcional** (nullable), con la
restricción `precio_hasta IS NULL OR precio_hasta >= precio_desde`. Sigue sin ser campo de
texto libre — la regla de producto 1 («nunca es campo de texto libre») no cambia, solo gana
un segundo número estructurado.

`precioLegible` renderiza:
- Solo `precio_desde` → `"Desde $X"` (comportamiento actual, sin cambios).
- `precio_desde` y `precio_hasta` → `"Desde $X hasta $Y"`.

No se toca `proveedor_oficios_sugeridos` (la cola de sugerencias de `/admin`, ADR 0013): el
techo es un dato que declara el propio prestador sobre su oficio ya publicado, no algo que
se sugiera al catálogo.

## Alternativas consideradas

**Reemplazar «desde» por un rango obligatorio.** Se descarta: rompe compatibilidad con todo
prestador que ya declaró solo un piso, y el PDF pide agregar, no reemplazar — el sentido de
«desde» (un piso, no una tarifa cerrada) sigue siendo válido para quien no quiera declarar
techo.

**Guardar el rango como texto en la descripción.** Se descarta de inmediato: es exactamente
lo que la regla de producto 1 prohíbe, y por la misma razón — un campo de texto libre en el
precio es donde se cuela un segundo teléfono.

## Qué reglas duras cambian de garante

| Regla | Hoy | Después |
| --- | --- | --- |
| Regla de producto 1 · precio = modo + «desde» + unidad | un solo valor numérico | modo + «desde» + **«hasta» opcional** + unidad; sigue prohibido el texto libre |

## Consecuencias

### Positivas

- Responde al pedido de la Fundación sin descartar el modelo de "piso declarado" que ya
  tenía sentido de producto.
- `precio_hasta` es opcional: ningún dato existente se invalida.

### Negativas

- Un segundo número por oficio es más fricción en el formulario de alta — mitigado por ser
  opcional.
- `precioLegible` gana una rama de formato más; cualquier lugar que hoy asuma "el precio es
  un solo número" (listados, exportaciones) debe revisarse — se deja como instrucción
  explícita en el plan de ejecución.

## Plan

1. Migración: columna `precio_hasta numeric(10,0)` nullable en `proveedor_oficios`, con
   `CHECK proveedor_oficios_precio_hasta_check (precio_hasta IS NULL OR (precio_hasta >= 0
   AND precio_hasta <= 99999999))` y `CHECK proveedor_oficios_rango_check (precio_hasta IS
   NULL OR precio_desde IS NULL OR precio_hasta >= precio_desde)`. La ejecuta el arquitecto
   (Claude Code) directamente — Antigravity no tiene acceso a la base.
2. Actualizar `src/db/generado/schema.ts`, `src/contrato/servicios.ts` (input y
   `OficioDeProveedor`), y `src/lib/servicios.ts:precioLegible`. También lo ejecuta el
   arquitecto, junto con la migración, en `Planes/esquema-precio-y-presentacion.md`.
3. Plan de ejecución para Antigravity (una vez el contrato esté mergeado) en
   `Planes/ficha-listado-rediseno-y-pedir-inline.md`, que consume `precio_hasta` en la
   ficha, el listado y el formulario.
