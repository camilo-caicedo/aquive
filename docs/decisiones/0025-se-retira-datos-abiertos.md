# ADR 0025 · Se retira la pantalla «Datos abiertos»

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Decide:** responsable del proyecto, a partir de revisión de la Fundación Nodo Social
- **Reemplaza:** la fila «Información → 40 ... Datos abiertos» de `AGENTS.md` §Pantallas
- **Fuente:** `aquive-cambios.pdf`, revisión de la Fundación, 2026-09-10

## Contexto

`/datos` publica, sin nombres ni forma de reconstruir quién pidió qué, qué se buscó y en qué
municipio, con la nota «estos datos son públicos a propósito: son el aporte que sobrevive al
proyecto cuando deje de operar». La Fundación pide retirar esta pantalla del todo.

## Decisión

Se retira `app/datos` (y su ruta, y sus dos enlaces — menú hamburguesa y pie de página). No
se retira el banner "Solo para pruebas..." (`components/aviso-pruebas.tsx`) — ese banner es
global, aparece en todo entorno que no sea producción, y no era el punto real del pedido: se
confirmó con la Fundación que lo que querían quitar era la pantalla, no el aviso de entorno.

## Alternativas consideradas

**Dejar la ruta pero quitarla de la navegación.** Se descarta: si nadie puede llegar ahí
desde la interfaz, mantener el código vivo es deuda sin propósito, y contradice la regla de
producto 3 en espíritu — lo que no se necesita, se borra, no se esconde.

## Qué reglas duras cambian de garante

| Regla | Hoy | Después |
| --- | --- | --- |
| `AGENTS.md` §Pantallas · grupo «Información» | incluye Datos abiertos | se retira esa entrada |

Ninguna regla del mínimo legal ni de producto dependía de que `/datos` existiera — es
transparencia opcional, no una obligación del RNBD ni de habeas data (esas viven en `/pqr` y
`docs/PENDIENTES-LEGALES.md`, que no cambian).

## Consecuencias

### Positivas

- Una pantalla y una ruta menos que mantener.

### Negativas

- Se pierde la única transparencia pública sobre qué se buscó y no se encontró — dato que la
  propia pantalla describía como "el aporte que sobrevive al proyecto cuando deje de
  operar". Si la Fundación reconsidera, hay que decidir si vuelve como estaba o en otra
  forma (ej. un reporte periódico en vez de una pantalla viva).

## Plan

1. `AGENTS.md` §Pantallas: quitar «Datos abiertos» de la fila «Información».
2. Plan de ejecución para Antigravity en `Planes/datos-abiertos-retirar-pantalla.md`.
