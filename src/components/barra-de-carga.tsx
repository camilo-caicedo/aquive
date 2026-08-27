'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * La barra fina de progreso al cambiar de pantalla.
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
 */

/** Un tope, para no dejarla encendida si algo no llega nunca. */
const TOPE = 8000

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
  const [nav, setNav] = useState<{ desde: string; vuelta: number } | null>(null)
  const cargando = nav !== null && nav.desde === ruta

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

      setNav((n) => ({
        desde: window.location.pathname,
        vuelta: (n?.vuelta ?? 0) + 1,
      }))
    }

    document.addEventListener('click', alTocar, { capture: true })
    return () => document.removeEventListener('click', alTocar, { capture: true })
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
  )
}
