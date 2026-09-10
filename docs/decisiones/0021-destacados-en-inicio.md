# ADR 0021 · Vuelve una sección de destacados a `/inicio`

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Decide:** responsable del proyecto, a partir de revisión de la Fundación Nodo Social
- **Reemplaza:** el ADR 0016 **en un solo punto** — la retirada de secciones destacadas de
  `/inicio`. El resto del ADR 0016 (fuera el tablero de pedidos, fuera la cara «necesita»
  del muro) sigue vigente sin cambios.
- **Fuente:** `aquive-cambios.pdf`, revisión de la Fundación tras probar la aplicación,
  2026-09-10

## Contexto

El ADR 0016 retiró toda sección de descubrimiento pasivo de `/inicio` —«Disponibles ahora»,
productos, profesionales, entidades— con dos razones: rendimiento, y que esa forma de
conectar («publica y espera») era justo la que el cliente había rechazado tras probar la
app. `/inicio` quedó con dos cosas: las tres tarjetas de acción (Busco / Ofrezco / Dono) y
la grilla de categorías.

La Fundación Nodo Social, en su revisión del 2026-09-10, pide una sección «DESTACADOS»
debajo de las categorías, con este orden: `CATEGORÍAS ↓ DESTACADOS`.

La diferencia con lo que el ADR 0016 retiró es importante: aquello eran fichas elegidas por
recencia o disponibilidad — una forma de que el sistema empuje contenido activo, cercana a
«publica y espera». Esto es un escaparate de **quién ya tiene reputación construida en la
plataforma** (regla de producto 5: servicios confirmados, calificación) — más cerca de
ayudar a decidir a quién contactar que de sustituir la búsqueda.

## Decisión

Se agrega una sección «Destacados» en `/inicio`, debajo de la grilla de categorías.

**Criterio de selección:** reusa la misma fuente pública que ya alimenta el directorio y la
ficha —la vista `proveedores_publicos`, que ya aplica la regla de producto 7 (oculta riesgo
alto sin respaldo) y el filtro de suspendidos— ordenada por `servicios_confirmados`
descendente, límite 6. No hay curaduría manual de admin ni tabla nueva: es la misma consulta
que hoy arma el listado, con otro orden y otro límite.

⚠ **Este criterio es una propuesta del arquitecto, no una confirmación de la Fundación.** El
PDF no especifica qué hace que un prestador sea «destacado». Se eligió volumen de servicios
confirmados porque reusa código existente y es coherente con la regla de producto 5
(«volumen antes que promedio»). Si la Fundación quiere otro criterio —zona del visitante,
categorías con menos oferta, rotación— se ajusta en una iteración siguiente sin tocar el
resto de esta decisión.

## Alternativas consideradas

**Curaduría manual desde `/admin`.** Da control total a la Fundación, pero es una cola de
moderación nueva, con su propia pantalla y su propio dato — más superficie de la que este
cambio necesita para lo que pide el PDF. Se descarta por ahora; si el criterio automático no
sirve, es la siguiente escala natural.

**Traer de vuelta las secciones que retiró el ADR 0016 tal como estaban.** Se descarta
explícitamente: esas mezclaban productos, profesionales y entidades sin orden de reputación,
que es justo lo que el cliente rechazó. «Destacados» no es un regreso a esas secciones, es
una sección nueva con un criterio distinto.

## Qué reglas duras cambian de garante

| Regla | Hoy | Después |
| --- | --- | --- |
| ADR 0016 · `/inicio` sin descubrimiento pasivo | ninguna sección de contenido debajo de categorías | una sección, con criterio de reputación (no de recencia), reusando `proveedores_publicos` |

Ninguna regla del mínimo legal cambia de garante: `proveedores_publicos` ya filtra lo que no
debe ser público.

## Consecuencias

### Positivas

- Le da al directorio una puerta de entrada más, sin pedirle a nadie que publique y espere.
- No agrega tabla ni consulta nueva: reusa la vista y el orden ya disponible.

### Negativas

- Vuelve a acoplar el rendimiento de `/inicio` a una consulta sobre `proveedores_publicos`,
  justo lo que el ADR 0016 quería evitar — mitigado por el límite de 6 filas y por ser la
  misma vista que ya usa el directorio.
- El criterio «volumen de servicios confirmados» favorece a quien ya tiene reputación por
  encima de quien recién se registra, lo que puede sentirse como un club cerrado si nadie
  nuevo puede aparecer ahí. No se resuelve en este ADR.

### Neutras

Si la Fundación no confirma el criterio antes de construir, se avisa explícitamente en el
plan de ejecución (`Planes/inicio-seccion-destacados.md`) como supuesto a validar.

## Plan

1. `AGENTS.md` §Pantallas: anotar la sección nueva en la fila «Buscar» (05 Inicio).
2. Plan de ejecución para Antigravity en `Planes/inicio-seccion-destacados.md`.
