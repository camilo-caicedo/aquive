import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * El título de una pantalla de destino, pegado al encabezado.
 *
 * En el diseño la marca, el título y el segmentado son un solo bloque
 * sobre el papel, cerrado por una línea; el contenido empieza después. Sin
 * esto el título flotaba en medio del cuerpo con su propio margen y la
 * pantalla parecía empezar dos veces.
 *
 * ⚠ El `h1` vive aquí y no dentro del `<header>` global a propósito: el
 * encabezado se monta una vez en el layout y no sabe en qué ruta está —esa
 * es la misma razón por la que `Navegacion` es cliente—. Lo que hace que se
 * vea como un solo bloque es que este va pegado arriba, sin margen, con el
 * mismo fondo y su `border-b`.
 *
 * `volver` es para las pantallas que son destino Y se entra a ellas desde
 * otra —`/solicitud/[token]` es la única hoy—: llevan flecha atrás y a la
 * vez conservan la barra inferior, porque no son un formulario del que se
 * pueda salir a medio llenar.
 *
 * Los márgenes negativos existen porque el `<main>` ya trae `px-4`: la
 * línea de abajo tiene que llegar a los dos bordes de la pantalla.
 */
export function CabeceraPantalla({
  titulo,
  volver,
  children,
}: {
  titulo: string
  volver?: string
  /** El segmentado, los chips de filtro: lo que va pegado al título. */
  children?: ReactNode
}) {
  return (
    <div className="-mx-4 -mt-6 mb-4 border-b border-border px-4 pt-2 pb-3">
      <div className="flex items-center gap-1">
        {volver && (
          <Link
            href={volver}
            aria-label="Volver"
            className="-ml-3 flex size-12 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-6" aria-hidden="true" />
          </Link>
        )}
        <h1 className="font-heading text-3xl leading-tight">{titulo}</h1>
      </div>
      {children}
    </div>
  )
}
