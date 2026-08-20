'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Un `<details>` que recuerda si lo cerraste, en este teléfono.
 *
 * ⚠ Se sirve SIEMPRE abierto y el cierre se aplica después, tocando la
 * propiedad `open` del elemento. No es un capricho de implementación:
 *
 * - El contenido cerrado tiene que seguir en el HTML servido. En la portada
 *   ahí dentro va lo que la revisión de la marca de Google lee para saber
 *   para qué es la cuenta. Si el estado viviera en React y sacara el bloque
 *   del DOM, el revisor —y cualquier rastreador— vería una portada que no
 *   explica nada.
 * - Y sin JavaScript queda abierto, que es el lado seguro del fallo.
 *
 * El recuerdo va en `localStorage`, nunca en la base: es una preferencia de
 * este aparato, no un dato de nadie.
 */
export function PlegableRecordado({
  id,
  className,
  children,
}: {
  /** Clave de `localStorage`. Única por plegable. */
  id: string
  className?: string
  children: ReactNode
}) {
  const caja = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const elemento = caja.current
    if (!elemento) return

    // `try` porque en navegación privada de algunos navegadores el simple
    // acceso a `localStorage` lanza, y eso no puede tumbar la portada.
    try {
      if (localStorage.getItem(id) === 'cerrado') elemento.open = false
    } catch {}

    const alCambiar = () => {
      try {
        localStorage.setItem(id, elemento.open ? 'abierto' : 'cerrado')
      } catch {}
    }
    elemento.addEventListener('toggle', alCambiar)
    return () => elemento.removeEventListener('toggle', alCambiar)
  }, [id])

  return (
    <details ref={caja} open className={className}>
      {children}
    </details>
  )
}
