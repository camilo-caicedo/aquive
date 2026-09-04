import type { ReactNode } from 'react'
import { BotonVolver } from '@/components/volver'

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
 * otra: llevan flecha atrás y a la
 * vez conservan la barra inferior, porque no son un formulario del que se
 * pueda salir a medio llenar.
 *
 * Su valor es el padre de la ruta, y es a donde se va cuando NO hay
 * historia detrás. Habiéndola, la flecha vuelve a la pantalla anterior de
 * verdad. Lo explica `BotonVolver`.
 *
 * Los márgenes negativos existen porque el `<main>` ya trae `px-4`: la
 * línea de abajo tiene que llegar a los dos bordes de la pantalla.
 */
export function CabeceraPantalla({
  titulo,
  volver,
  etiquetaVolver,
  children,
}: {
  titulo: string
  volver?: string
  /**
   * La palabra de dónde vienes: «Aseo», «Categorías».
   *
   * Con ella la vuelta sube a su propio renglón encima del título, porque
   * un título largo y una migaja larga no caben en la misma línea de un
   * teléfono. Sin ella la flecha va al lado del título, que es lo de
   * siempre.
   */
  etiquetaVolver?: string
  /** El segmentado, los chips de filtro: lo que va pegado al título. */
  children?: ReactNode
}) {
  return (
    <div className="-mx-4 -mt-6 mb-4 border-b border-border px-4 pt-2 pb-3">
      {volver && etiquetaVolver ? (
        <>
          <BotonVolver href={volver} etiqueta={etiquetaVolver} />
          <h1 className="font-heading text-3xl leading-tight">{titulo}</h1>
        </>
      ) : (
        <div className="flex items-center gap-1">
          {volver && <BotonVolver href={volver} />}
          <h1 className="font-heading text-3xl leading-tight">{titulo}</h1>
        </div>
      )}
      {children}
    </div>
  )
}
