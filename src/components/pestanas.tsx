'use client'

import Link from 'next/link'
import { useLayoutEffect, useRef } from 'react'

import { useHidratado } from '@/components/hidratado'

export interface Pestana {
  href: string
  etiqueta: string
  activa: boolean
  /** Número al lado de la etiqueta: respuestas, pendientes, lo que sea. */
  cuenta?: number
}

/**
 * La barra de pestañas de todo el sitio. Enlaces con el estado en la URL,
 * no estado de cliente: se puede compartir, el atrás del navegador
 * funciona y cada pestaña consulta solo lo suyo.
 *
 * Existe porque cinco pantallas —solicitud, perfil, organización,
 * moderación y servicios— habían crecido hasta ser un rollo vertical
 * donde todo competía por la atención.
 *
 * ⚠ Antes eran píldoras con borde, iguales a los botones `outline` que
 * suelen ir justo debajo, y en /servicios no se distinguía qué era
 * navegación y qué era una acción. Ahora es un control segmentado —una
 * sola pieza con fondo apagado, y la activa levantada en papel—, que se
 * lee como «un grupo donde eliges uno» y no como «tres botones sueltos».
 * Es la forma del componente Tabs de shadcn sobre Base UI.
 *
 * No usa `Tabs` de Base UI a propósito: aquello monta paneles y estado en
 * el cliente, y esto son enlaces a rutas distintas renderizadas en el
 * servidor. Se toma la apariencia, no la maquinaria.
 *
 * El alto sigue en 48 px, que es lo que manda CLAUDE.md aunque el
 * original de shadcn sea más bajo: esto se toca de pie y con prisa.
 *
 * ⚠ Pasó a `'use client'` para que el papel de la activa se DESLICE entre
 * pestañas en vez de saltar. Lo que se mueve es una píldora absoluta detrás
 * de los enlaces; los enlaces siguen siendo `<Link>` a rutas del servidor y
 * nada del contenido se volvió cliente.
 */
export function Pestanas({
  etiqueta,
  pestanas,
}: {
  /** Para el lector de pantalla: «Secciones de tu solicitud». */
  etiqueta: string
  pestanas: Pestana[]
}) {
  const lista = useRef<HTMLUListElement>(null)

  // Antes de hidratar, el papel va en el propio enlace, como siempre: la
  // primera pintada del cliente es idéntica a la del servidor (ADR 0005) y
  // sin JavaScript la pestaña activa se sigue viendo.
  const hidratado = useHidratado()
  const activa = pestanas.findIndex((p) => p.activa)

  // Se coloca desde el DOM y no desde el estado: así no hay un render de
  // más por cada medida, y la primera colocación puede ser instantánea
  // mientras las siguientes se deslizan.
  useLayoutEffect(() => {
    const ul = lista.current
    if (!ul || activa < 0) return

    function colocar() {
      if (!ul) return
      // ⚠ La píldora se busca por atributo y no por `ref`. Con un `ref`,
      // el compilador de React marca la lectura como acceso durante el
      // render en cuanto la función se le pasa a un `ResizeObserver`, que
      // es lo que hace falta aquí.
      const p = ul.querySelector('[data-pildora]')
      // ⚠ Los `<li>`, no `ul.children`: la píldora también es hija del
      // `<ul>` y va primera, así que por índice se cogería la pestaña
      // equivocada.
      const el = ul.querySelectorAll('li')[activa]
      if (!(p instanceof HTMLElement) || !(el instanceof HTMLElement)) return

      p.style.width = `${el.offsetWidth}px`
      p.style.transform = `translateX(${el.offsetLeft}px)`

      // ⚠ La transición se pone DESPUÉS de escribir la posición, y a
      // propósito. En la primera colocación el navegador ya tiene el valor
      // nuevo cuando aparece la regla, así que no hay nada que animar y la
      // píldora cae en su sitio en vez de entrar deslizándose desde el
      // borde izquierdo cada vez que carga la pantalla. En las siguientes
      // la regla ya está puesta y sí se desliza.
      p.style.transition = 'transform var(--dur-media) var(--curva-entrada)'
    }

    colocar()

    // El riel se arrastra y la ventana cambia de tamaño; en las dos cosas
    // la píldora tiene que volver a cuadrar con su pestaña.
    const observador = new ResizeObserver(colocar)
    observador.observe(ul)
    return () => observador.disconnect()
  }, [activa, pestanas.length])

  return (
    <nav aria-label={etiqueta} className="riel -mx-4 overflow-x-auto px-4">
      <ul
        ref={lista}
        className="relative inline-flex w-full min-w-fit items-center gap-1 rounded-full bg-secondary p-1.5"
      >
        {/* El papel que se desliza.
            ⚠ Solo se anima `transform`. El ancho se pone de golpe, sin
            transición: animar `width` es exactamente lo que la regla de
            accesibilidad prohíbe, y como las pestañas son `flex-1` casi
            siempre miden lo mismo y el cambio no se ve. */}
        {hidratado && (
          <span
            data-pildora=""
            aria-hidden="true"
            className="shadow-canto pointer-events-none absolute top-1.5 bottom-1.5 left-0 rounded-full bg-card"
          />
        )}

        {pestanas.map((p) => (
          <li key={p.href} className="relative min-w-fit flex-1">
            <Link
              href={p.href}
              aria-current={p.activa ? 'page' : undefined}
              // ⚠ La activa iba en relleno primario, y por una razón que
              // sigue siendo cierta: sobre el papel cálido de este sitio
              // un papel elevado casi no se distingue del riel, y menos
              // con el sol de frente, que es donde de verdad se usa esto.
              //
              // Aun así baja a papel, porque la terracota es de la acción
              // principal y de nada más (regla 2): con las dos cosas
              // iguales, la pestaña activa y el botón de publicar se leían
              // igual. Lo que compensa el contraste que se pierde es el
              // borde —que el papel pelado no tenía—, más la sombra y el
              // peso de la letra: tres señales en vez de una, y ninguna
              // depende solo del tono.
              className={`relative inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full px-5 text-base whitespace-nowrap transition-colors duration-[var(--dur-corta)] ${
                p.activa
                  ? // El papel lo pone la píldora en cuanto hidrata. Aquí
                    // solo mientras tanto, para que no haya un parpadeo sin
                    // fondo entre el HTML del servidor y la medición.
                    `font-semibold text-foreground ${hidratado ? '' : 'bg-card shadow-canto'}`
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.etiqueta}
              {p.cuenta !== undefined && p.cuenta > 0 && (
                <span
                  // En la activa va arena y no un blanco translúcido: el
                  // de antes se apoyaba en el relleno terracota, y sobre
                  // papel desaparece.
                  className={`rounded-full px-2 text-sm transition-colors duration-[var(--dur-corta)] ${
                    p.activa
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-background text-muted-foreground'
                  }`}
                >
                  {p.cuenta}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
