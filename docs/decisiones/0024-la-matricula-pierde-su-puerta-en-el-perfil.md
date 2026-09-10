# ADR 0024 · La matrícula pierde su puerta de autoservicio en el perfil

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Decide:** responsable del proyecto, a partir de revisión de la Fundación Nodo Social
- **Reemplaza:** ajusta la regla de producto 6 de `AGENTS.md` — se retira una de las cuatro
  señales de verificación como entrada de autoservicio; las otras tres, y la propia
  matrícula como dato y como moderación de admin, no cambian
- **Fuente:** `aquive-cambios.pdf`, revisión de la Fundación, 2026-09-10

## Contexto

El menú de `/perfil` muestra siempre una fila «Agregar mi matrícula» / «Mi matrícula», hacia
`/perfil/matricula`. El propio código la documenta como **la única puerta** a esa pantalla
desde que `/registro` se retiró: sin esta fila, nadie —ni cuenta nueva ni cuenta que ya
declaró matrícula— tiene cómo llegar ahí desde la interfaz.

La Fundación pide quitarla del menú. No es un pedido de ocultarla condicionalmente: es
quitarla entera.

## Decisión

Se retira la fila «Agregar mi matrícula» / «Mi matrícula» del menú de `/perfil`, sin
reemplazo por ahora. Consecuencia directa, y no un efecto colateral: **la declaración de
matrícula deja de tener una puerta de autoservicio.**

- Una cuenta `vecino` no tiene forma de convertirse en `servidor` declarando su matrícula
  por su cuenta — `tipo` solo cambia a `servidor` cuando se declara matrícula, y sin esta
  fila no hay dónde declararla.
- Una cuenta `servidor` que ya declaró matrícula **tampoco tiene ya una entrada de
  autoservicio para verla o editarla** — el propio comentario del código confirma que era
  la única puerta.
- La ruta `/perfil/matricula` y el dominio detrás (`src/server/servicios/matricula.ts`) no
  se borran: siguen existiendo para quien llegue con la URL directa (un admin puede
  compartirla), y la cola de moderación en `/admin/matriculas` no cambia.

**Lo que NO cambia:** la lógica de riesgo alto de la regla de producto 7 —que esconde
oficios de riesgo alto sin teléfono verificado y referencia confirmada— no usa matrícula en
absoluto (confirmado en el código: `src/server/servicios/consultas.ts` no la referencia). El
directorio `/profesionales` y `servidores_publicos` siguen mostrando la matrícula de quien
ya la tiene. Solo se apaga la puerta para declarar una nueva.

## Alternativas consideradas

**Ocultar la fila solo para cuentas `vecino` sin oficio que la exija, dejarla visible para
`servidor`.** Es la lectura más conservadora y la que se le propuso a la Fundación, pero
ellos confirmaron que quieren quitarla entera, no condicionarla.

**Quitar la fila y dejar un enlace en otro lado (ej. dentro de "Mis oficios y precios") para
quien de verdad la necesite.** Se descarta por ahora: el PDF no pide un reemplazo, y agregar
uno sin que lo pidan es inventar alcance. Si la Fundación nota que nadie puede declarar
matrícula nueva, es una revisión futura de este mismo ADR.

## Qué reglas duras cambian de garante

| Regla | Hoy | Después |
| --- | --- | --- |
| Regla de producto 6 · cuatro señales de verificación, todas blandas | las cuatro tienen un camino de autoservicio desde `/perfil` | la matrícula pierde su camino de autoservicio; las otras tres (teléfono, referencia, servicios confirmados) no cambian. La señal en sí —y su verificación manual por un miembro de la fundación cuando llega por otra vía— sigue existiendo |
| Regla de producto 7 · riesgo alto exige teléfono + referencia | no usa matrícula | sin cambio — nunca la usó |

## Consecuencias

### Positivas

- Responde al pedido explícito de la Fundación.
- Ninguna garantía de mínimo legal se debilita: matrícula nunca fue una verificación de
  identidad (regla 6 ya lo aclaraba) ni condiciona el mínimo legal 1 (menores).

### Negativas, y hay que decirlas sin adornos

**Se apaga por completo la puerta de autoservicio para declarar matrícula, para cuentas
nuevas y para las que ya la tenían.** No es una limpieza cosmética de menú: es que el
proyecto pierde, de la interfaz, la única forma en que alguien declaraba o revisaba su
propia matrícula sin que un admin le pasara el enlace a mano. Si la Fundación no anticipó
esta consecuencia completa, es una razón real para volver a revisar este ADR antes de
construir.

### Neutras

`docs/decisiones/LEEME.md` y la sección "Verificación" de `AGENTS.md` no necesitan un
`CHECK` nuevo: nada en la base impide declarar matrícula por otra vía si el proyecto decide
reabrir una puerta más adelante.

## Plan

1. `AGENTS.md`, regla de producto 6: anotar que matrícula ya no tiene camino de autoservicio
   desde `/perfil`.
2. Plan de ejecución para Antigravity en `Planes/perfil-quitar-matricula.md`.

## Revisión

Se revisa si la Fundación reporta que nadie logra declarar una matrícula nueva y eso frena
verificaciones que antes sí ocurrían — en ese caso hace falta decidir qué reemplaza la
puerta que se apagó, no solo reabrirla igual.
