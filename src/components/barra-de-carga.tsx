'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { usePathname } from 'next/navigation'

import { EsqueletoDeNavegacion } from '@/components/esqueleto-navegacion'

/**
 * Lo que dice que se está yendo a otra pantalla: una barra fina arriba y,
 * si la espera se alarga, las siluetas de lo que viene.
 *
 * ⚠ NO es un `loading.tsx` ni un `Suspense`, y no puede serlo. El ADR 0005
 * retiró `loading.tsx` después de comprobar con sondas que dejaba el subárbol
 * de la página **sin hidratar, nunca**: los desplegables salían como
 * `<select>` nativos y la hoja de filtros desplegada en el cuerpo. Esto es una
 * barra ENCIMA del árbol, no un límite alrededor de él.
 *
 * ⚠ Y por eso tampoco usa `useSearchParams()`, que obliga a envolver esto en
 * un `Suspense` y volvería a meter el mismo problema por otra puerta. Solo
 * `usePathname()`.
 *
 * El ADR 0005 dejó escrita la consecuencia que esto viene a tapar: «entre
 * tocar un enlace y ver la pantalla nueva, se queda la anterior». Es el
 * comportamiento de siempre del navegador, y en un teléfono con señal mala se
 * lee como que el toque no registró — así que se vuelve a tocar.
 *
 * ⚠ El esqueleto de aquí **no contradice al ADR 0005**, y la diferencia es
 * la que hace que funcione: aquel era un `Suspense` alrededor de la página,
 * y éste es marcado normal que se monta y se desmonta con estado de
 * cliente. Ningún límite, nada suspendido, nada que dejar sin hidratar.
 * Lo que sí cambia es una consecuencia escrita de ese ADR —«se queda la
 * anterior»—, y por eso va con el ADR 0016.
 */

/** Un tope, para no dejarla encendida si algo no llega nunca. */
const TOPE = 8000

/**
 * Lo que se espera antes de tapar la pantalla con siluetas.
 *
 * ⚠ Sin esta pausa el esqueleto parpadea en cada navegación instantánea
 * —las que ya están en la caché del enrutador— y eso se lee peor que no
 * poner nada: la pantalla salta dos veces para llegar al mismo sitio. La
 * barra fina sí sale de inmediato, que para eso es de 3 px.
 */
const ESPERA_ESQUELETO = 200

/**
 * Las rutas que se abren como hoja encima de lo que ya estaba, sin
 * desmontarlo (el slot `@modal` de `app/`). Ahí no hay pantalla en blanco
 * que rellenar, así que un esqueleto a página completa sería mentira.
 */
const INTERCEPTADAS = [
  /^\/prestador\/[^/]+$/,
  /^\/producto\/[^/]+$/,
  /^\/profesional\/[^/]+$/,
  /^\/entidad\/[^/]+$/,
  /^\/servicios\/(publicar|confirmar)$/,
  /^\/donaciones\/publicar$/,
]

export function BarraDeCarga() {
  const ruta = usePathname()

  // Desde qué pantalla se tocó, y cuántas veces. Guardar el origen en vez de
  // un booleano es lo que deja **derivar** si sigue cargando en vez de
  // apagarlo desde un efecto: cuando `usePathname()` devuelve otra cosa, la
  // pantalla nueva ya se montó y la barra se apaga sola en el mismo render.
  //
  // La `vuelta` remonta la barra interior para que la animación arranque de
  // cero. Sin ella corre una sola vez y del segundo toque en adelante
  // aparecería ya al final de su recorrido.
  //
  // `destino` es `null` cuando no toca enseñar siluetas —una hoja
  // interceptada, o un enlace que solo cambia la query—, y entonces se ve
  // la barra sola.
  const [nav, setNav] = useState<{
    desde: string
    vuelta: number
    destino: string | null
  } | null>(null)
  const cargando = nav !== null && nav.desde === ruta

  // El esqueleto va por su cuenta: la barra sale ya, esto espera.
  //
  // Se guarda PARA QUÉ vuelta se armó, y no un booleano, por lo mismo que
  // `nav` guarda el origen: así «hay esqueleto» se **deriva** y no hay que
  // acordarse de apagarlo. Al tocar otro enlace la vuelta sube, deja de
  // cuadrar y el esqueleto se rearma solo desde cero.
  const [armado, setArmado] = useState<number | null>(null)
  const conEsqueleto = cargando && nav.destino !== null && armado === nav.vuelta

  // La cuenta de vueltas y el temporizador viven en refs porque quien los
  // toca es el manejador del clic, que se registra una sola vez y no ve el
  // estado de renders posteriores.
  const vueltas = useRef(0)
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Delegación en el documento, no un envoltorio de `Link`: hay más de
    // doscientos enlaces repartidos y ninguno pasa por un componente común.
    function alTocar(e: MouseEvent) {
      // Botón secundario, o con una tecla puesta: eso abre en otra pestaña
      // y esta pantalla no se va a ninguna parte.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const enlace = (e.target as Element | null)?.closest?.('a[href]')
      if (!(enlace instanceof HTMLAnchorElement)) return
      if (enlace.target && enlace.target !== '_self') return
      if (enlace.hasAttribute('download')) return

      const destino = new URL(enlace.href, window.location.href)
      if (destino.origin !== window.location.origin) return
      // Un ancla dentro de la misma pantalla no navega a ninguna parte.
      if (destino.pathname === window.location.pathname && destino.hash) return

      // Un enlace que solo cambia la query —los filtros— se queda en la
      // misma pantalla: taparla entera para devolver la misma lista con
      // otro orden es perder de vista lo que se estaba mirando. Y encima
      // ahí `usePathname()` no cambia, así que el esqueleto se quedaría
      // puesto hasta el TOPE.
      const mismaPantalla = destino.pathname === window.location.pathname
      const enHoja = INTERCEPTADAS.some((p) => p.test(destino.pathname))
      // Con una hoja ya abierta, el esqueleto se pintaría detrás de ella.
      const hayHoja = !!document.querySelector('dialog[open]')

      // ⚠ `flushSync`, y no es adorno: sin él esto no se ve NUNCA en una
      // navegación normal. Este manejador corre en captura, o sea antes
      // que el de `Link`, pero React agrupa este `setState` con el
      // `startTransition` que `Link` lanza a continuación, y entonces el
      // único render ocurre cuando la pantalla nueva ya confirmó — con
      // `usePathname()` devolviendo el destino, `cargando` en `false` y
      // esto devolviendo `null`. Medido: el manejador corría en el
      // milisegundo 1 y el primer render llegaba en el 549, ya tarde.
      //
      // `flushSync` pinta el aviso AHORA, antes de que la transición
      // empiece, que es todo el propósito de este componente.
      const vuelta = ++vueltas.current
      const conSiluetas = !(mismaPantalla || enHoja || hayHoja)

      flushSync(() => {
        setNav({
          desde: window.location.pathname,
          vuelta,
          destino: conSiluetas ? destino.pathname : null,
        })
      })

      // ⚠ La pausa se arma AQUÍ y no en un efecto. Estándolo, no llegaba a
      // correr: React no despacha los efectos pasivos de este commit
      // mientras la transición de `Link` sigue en vuelo, así que el
      // temporizador no se creaba nunca y el esqueleto no salía — con la
      // barra funcionando, que es lo que despistaba. Aquí es una línea
      // imperativa en un manejador que ya sabemos que corre en el
      // milisegundo 1.
      if (espera.current) clearTimeout(espera.current)
      if (conSiluetas) {
        espera.current = setTimeout(
          // ⚠ `flushSync` otra vez, y por la misma razón que arriba: con la
          // transición de `Link` todavía en vuelo, un `setState` normal no
          // se pinta hasta que la pantalla nueva confirma — o sea, justo
          // cuando el esqueleto ya no sirve para nada.
          () => flushSync(() => setArmado(vuelta)),
          ESPERA_ESQUELETO
        )
      }
    }

    document.addEventListener('click', alTocar, { capture: true })
    return () => {
      document.removeEventListener('click', alTocar, { capture: true })
      if (espera.current) clearTimeout(espera.current)
    }
  }, [])

  useEffect(() => {
    if (!cargando) return
    // ⚠ Los filtros cambian la *query* y no el *path*, así que ahí
    // `usePathname()` devuelve lo mismo y la barra no se apagaría sola.
    // Sin este tope se quedaría encendida hasta la siguiente navegación de
    // verdad.
    const t = setTimeout(() => setNav(null), TOPE)
    return () => clearTimeout(t)
  }, [cargando])

  if (!cargando) return null

  return (
    <>
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]"
    >
      {/* Solo `transform`, como todo lo que se anima aquí: sobre la GPU y sin
          reflow. `prefers-reduced-motion` ya lo apaga entero desde
          `globals.css`, y entonces se queda como una barra quieta, que sigue
          diciendo que algo está pasando.

          ⚠ Se monta y se desmonta en vez de esconderse con una transición de
          opacidad. Lo intentado primero fue lo segundo, y en una pestaña sin
          foco el navegador congela la transición: la clase `opacity-100`
          quedaba puesta y el valor calculado seguía en cero, o sea una barra
          que existe y no se ve. Montar y desmontar no depende del
          compositor. */}
      <div key={nav.vuelta} className="barra-avance bg-primary h-full origin-left" />
    </div>

    {/* Va aquí abajo, y no arriba con la barra, porque ocupa el sitio de
        `#contenido` en la columna del `body`: encabezado pegajoso encima,
        barra inferior fija debajo, y el desplazamiento donde siempre. Quien
        esconde el contenido viejo mientras tanto es `globals.css`, con
        `:has()` sobre el `data-esqueleto-navegacion` de este nodo. */}
    {conEsqueleto && nav.destino && <EsqueletoDeNavegacion destino={nav.destino} />}
    </>
  )
}
