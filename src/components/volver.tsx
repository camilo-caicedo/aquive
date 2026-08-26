'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * La flecha de volver.
 *
 * Vuelve a la pantalla ANTERIOR, no al padre de la ruta. Con un `href`
 * fijo, entrar a una ficha desde «Disponibles ahora» y darle atrás te
 * dejaba en el directorio —que es el padre de la ficha, pero no es de
 * donde venías—, y desde ahí ya no había manera de volver al inicio sin
 * usar la barra.
 *
 * `href` sigue siendo obligatorio y sigue siendo el padre de la ruta,
 * porque es lo que se usa cuando NO hay a dónde volver: quien abre la
 * ficha desde un enlace de WhatsApp no tiene historia de esta aplicación
 * detrás, y `history.back()` lo sacaría del sitio. Es también el destino
 * real del enlace, así que abrirlo en otra pestaña o con el clic central
 * sigue funcionando, y un rastreador ve una ruta y no un `button`.
 */
const CLAVE = 'aquive:navegado'

/**
 * Marca que en esta pestaña ya hubo una navegación dentro de la
 * aplicación, que es la condición para que `history.back()` sea seguro.
 *
 * Va montado en el layout, así que sobrevive a los cambios de ruta: el
 * primer efecto es la carga del documento —y ahí la marca se borra, porque
 * la entrada anterior de la historia es de otro sitio—; los siguientes son
 * navegaciones de cliente y sí la ponen.
 *
 * `sessionStorage` y no un estado en memoria: recargar la página no borra
 * la historia del navegador, así que la marca tiene que sobrevivir a la
 * recarga igual que sobrevive la flecha del navegador.
 */
export function RastroDeNavegacion() {
  const ruta = usePathname()
  const primera = useRef(true)

  useEffect(() => {
    try {
      if (primera.current) {
        primera.current = false
        // Solo la carga desde cero limpia la marca. Una recarga (F5) es
        // otra carga de documento pero la historia sigue estando, así que
        // se distingue por el tipo de navegación que reporta el navegador.
        const [entrada] = performance.getEntriesByType(
          'navigation',
        ) as PerformanceNavigationTiming[]
        if (entrada?.type !== 'reload' && entrada?.type !== 'back_forward') {
          sessionStorage.removeItem(CLAVE)
        }
        return
      }
      sessionStorage.setItem(CLAVE, '1')
    } catch {
      // Navegador con el almacenamiento bloqueado. Sin marca, la flecha
      // usa su `href`, que es el comportamiento de antes.
    }
  }, [ruta])

  return null
}

export function BotonVolver({ href }: { href: string }) {
  const router = useRouter()

  return (
    <Link
      href={href}
      aria-label="Volver"
      className="-ml-3 flex size-12 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
      onClick={(e) => {
        // Abrir en otra pestaña, o con el clic central, tiene que seguir
        // abriendo el `href`. Interceptar eso también sería robarle al
        // navegador algo que ya hace bien.
        if (e.defaultPrevented || e.button !== 0) return
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        try {
          if (!sessionStorage.getItem(CLAVE)) return
        } catch {
          return
        }
        e.preventDefault()
        router.back()
      }}
    >
      <ArrowLeft className="size-6" aria-hidden="true" />
    </Link>
  )
}
