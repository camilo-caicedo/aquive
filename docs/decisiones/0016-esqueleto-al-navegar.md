# ADR 0016 · Vuelve el esqueleto, pero al navegar y sin `Suspense`

- **Estado:** aceptada
- **Fecha:** 2026-09-04
- **Decide:** el responsable
- **Cambia:** una consecuencia del ADR 0005. No lo sustituye

## Contexto

El ADR 0005 retiró `loading.tsx` y dejó escrita esta consecuencia:

> **No hay esqueleto de carga en ninguna pantalla.** Entre tocar un enlace y
> ver la pantalla nueva, se queda la anterior.

Eso se comprobó otra vez el 4 de septiembre de 2026 y **sigue siendo cierto
para `Suspense`** — la tabla de sondas está al final del ADR 0005, y el
hallazgo nuevo es que no falla `loading.tsx`, falla cualquier límite de
`Suspense`, también en producción y también en Next 16.3.4.

Pero el hueco que aquello dejaba abierto era real: en un teléfono con señal
mala, una pantalla que no cambia en dos segundos se lee como que el toque no
registró, y se vuelve a tocar. `BarraDeCarga` tapaba eso con una línea de
3 px, que es poco para una espera larga.

## Decisión

El esqueleto vuelve, **por la otra puerta**: no como límite de carga del
enrutador, sino como marcado normal que un componente de cliente monta y
desmonta mientras dura la navegación.

- Lo monta `BarraDeCarga`, que ya sabía cuándo empieza y acaba una
  navegación. Mismo detector, misma vida, ahora con dos señales: la línea
  sale de inmediato y las siluetas si la espera se alarga.
- **No hay ningún `Suspense` de por medio**, así que no toca lo que el ADR
  0005 encontró. Nada queda suspendido y nada se queda sin hidratar.
- La forma sale del **destino**, que se sabe al tocar el enlace: rejilla
  para «Hecho en el barrio» y donaciones, filas para zonas, campos para
  perfil y las altas, lista para lo demás.
- Ocupa el sitio de `#contenido` en la columna del `body`, y `globals.css`
  esconde el contenido viejo con `:has()`. Así el encabezado pegajoso, la
  barra inferior fija y el desplazamiento quedan donde estaban, sin una
  sola medida a mano.

### Cuándo NO sale

Tres casos, y los tres son la diferencia entre ayudar y estorbar:

| Cuándo | Por qué |
| --- | --- |
| Antes de 200 ms | Una navegación que ya está en caché se resolvería antes, y la pantalla saltaría dos veces para llegar al mismo sitio |
| Rutas del slot `@modal` | Se abren como hoja **encima** de lo que ya estaba: no hay pantalla en blanco que rellenar |
| Enlaces que solo cambian la query | Son los filtros: se sigue en la misma pantalla, y taparla entera es perder de vista lo que se estaba mirando |

## Lo que costó, y que no se vuelva a perder

**Sin `flushSync` esto no se ve nunca.** El manejador del clic corre en
captura, antes que el de `Link`, pero React agrupa ese `setState` con el
`startTransition` que `Link` lanza justo después: el único render llegaba
cuando la pantalla nueva ya había confirmado, con `usePathname()`
devolviendo el destino y el aviso apagándose sin haberse encendido. Medido
en el navegador: el manejador corría en el milisegundo 1 y el primer render
en el 549.

Y por lo mismo **la pausa de 200 ms se arma en el manejador, no en un
efecto**: React no despacha los efectos pasivos de ese commit mientras la
transición sigue en vuelo, así que el temporizador no llegaba a crearse. El
síntoma era desconcertante —la barra funcionaba y el esqueleto no— y ahí se
fue la mayor parte del tiempo.

⚠ Para medirlo hace falta la pestaña **visible**: en una oculta Chrome
estrangula los temporizadores a uno por segundo y cualquier medida de una
pausa de 200 ms sale mal.

## Consecuencias

- Se sustituye la consecuencia del ADR 0005: al navegar ya no se queda la
  pantalla anterior más de 200 ms; se queda su silueta.
- **El `Suspense` sigue prohibido**, y con él `loading.tsx`. Lo de aquí no
  es una puerta trasera para reintroducirlo: es lo que se puede hacer
  mientras siga roto.
- `Siluetas` de `components/estado.tsx` se retiró: era el resto del
  `loading.tsx` de agosto y ahora hay `Skeleton` en `components/ui/`.
