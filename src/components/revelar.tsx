'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Lo que entra en pantalla al desplazar, aparece.
 *
 * Sin librería: un `IntersectionObserver` y CSS. El componente solo pone
 * atributos; la animación entera vive en `globals.css`.
 *
 * ⚠⚠ EMPIEZA VISIBLE Y SE ESCONDE DESPUÉS, nunca al revés.
 *
 * La forma habitual de esto es poner `opacity: 0` en el CSS y quitarlo con
 * JavaScript. Aquí eso es inaceptable: el público entra desde Android de
 * gama baja con señal mala, y cualquier cosa que impida que el JavaScript
 * corra —que no llegue, que reviente, que el navegador congele la pestaña—
 * deja la pantalla EN BLANCO con el contenido servido y escondido.
 *
 * Y no es hipotético: probando esto, el `IntersectionObserver` de una
 * pestaña en segundo plano no entregó una sola vez en más de un segundo.
 *
 * Así que el CSS no esconde nada por su cuenta. Es el efecto el que marca
 * el contenedor con `data-listo` —y solo cuando ya tiene el observador en
 * marcha— y a partir de ahí sí se esconde lo que falta por revelar. Si algo
 * falla en cualquier punto anterior, se ve todo. Una animación no puede
 * costar el acceso al contenido.
 *
 * Los ajustes de abajo vienen probados del frontend de Coffea, que hizo
 * esto antes, y se copian con su razón para no volver a tropezar.
 */

/**
 * ⚠ `threshold: 0` con margen inferior negativo, y NO un umbral por
 * proporción visible.
 *
 * Con `threshold: 0.15` fallaban dos cosas a la vez: un bloque más alto que
 * unas seis pantallas NUNCA puede tener el 15 % visible de golpe, así que
 * no disparaba nunca; y en el caso normal disparaba en cuanto asomaba por
 * abajo, con lo que la entrada terminaba antes de que nadie la mirara.
 */
const MARGEN = '0px 0px -20% 0px'

/**
 * Si a los cuatro segundos el observador no ha entregado nada, se revela todo
 * y se acabó. Es la diferencia entre «no se animó» y «no se ve».
 */
const PACIENCIA = 4000

/** El escalonado de lo que ya está en pantalla, topado. */
const PASOS = 5
const PASO_MS = 60

/** ¿Está dentro de la ventana o por encima de ella? */
function yaSeVe(el: Element) {
  // ⚠ `top < innerHeight` a secas, sin `&& bottom > 0`. Con las dos
  // condiciones, lo que queda POR ENCIMA de la ventana —al restaurar el
  // desplazamiento con el atrás del navegador— se quedaba invisible para
  // siempre: ya está fuera, así que el observador tampoco lo iba a
  // rescatar.
  return el.getBoundingClientRect().top < window.innerHeight
}

/**
 * Una lista cuyos elementos aparecen a medida que se llega a ellos.
 *
 * Un solo observador para todos: veinte observadores serían veinte
 * suscripciones para el mismo trabajo.
 */
export function RevelarLista({
  children,
  className = '',
  como: Como = 'ul',
}: {
  children: ReactNode
  className?: string
  /** `ul` por defecto; `ol` donde el orden signifique algo. */
  como?: 'ul' | 'ol' | 'div'
}) {
  const caja = useRef<HTMLElement>(null)

  useEffect(() => {
    const contenedor = caja.current
    if (!contenedor) return

    const hijos = [...contenedor.children]
    if (hijos.length === 0) return

    // La rendición NO pasa por la transición: la escribe en línea y sin
    // transición ninguna.
    //
    // ⚠ Una transición de opacidad se CONGELA en una pestaña en segundo
    // plano —comprobado en este mismo navegador—, así que rendirse
    // poniendo `data-dentro` y esperar a que la transición llegue a 1
    // dejaría el contenido en cero justo en el caso que esto viene a
    // cubrir. Aquí se pone el valor final a mano y se acabó.
    function revelarTodo() {
      for (const h of hijos) {
        h.setAttribute('data-dentro', '')
        if (h instanceof HTMLElement) {
          h.style.transition = 'none'
          h.style.opacity = '1'
          h.style.transform = 'none'
        }
      }
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue
          e.target.setAttribute('data-dentro', '')
          // Cada uno se deja de observar en cuanto entra; el observador
          // sigue vivo para los que faltan.
          observador.unobserve(e.target)
        }
      },
      { threshold: 0, rootMargin: MARGEN },
    )

    // Los que ya se ven entran escalonados, que es lo que da la sensación
    // de que la lista se arma. Los de más abajo entran de uno en uno al
    // llegar a ellos, sin retraso: ahí el escalonado sobra porque nunca
    // llegan dos a la vez.
    let visibles = 0
    const relojes: ReturnType<typeof setTimeout>[] = []
    for (const hijo of hijos) {
      if (yaSeVe(hijo)) {
        if (hijo instanceof HTMLElement) {
          hijo.style.transitionDelay = `${Math.min(visibles, PASOS) * PASO_MS}ms`
          // ⚠ El retraso se quita al terminar. Si se queda puesto, la
          // siguiente transición del elemento —el encogido al pulsarlo—
          // sale con ese mismo retraso y el toque se siente muerto.
          relojes.push(setTimeout(() => (hijo.style.transitionDelay = ''), 900))
        }
        visibles++
        hijo.setAttribute('data-dentro', '')
      } else {
        observador.observe(hijo)
      }
    }

    // Solo AHORA se le permite al CSS esconder lo que falta: con el
    // observador ya montado y lo visible ya marcado.
    contenedor.setAttribute('data-listo', '')

    // Y si aun así el observador no responde —pestaña en segundo plano, que
    // pasa constantemente en un teléfono—, se revela todo antes que dejar
    // nada escondido.
    const rendicion = setTimeout(() => {
      if (hijos.some((h) => !h.hasAttribute('data-dentro'))) revelarTodo()
    }, PACIENCIA)

    return () => {
      observador.disconnect()
      clearTimeout(rendicion)
      for (const r of relojes) clearTimeout(r)
    }
  }, [children])

  return (
    <Como ref={caja as never} data-revelar-lista className={className}>
      {children}
    </Como>
  )
}
