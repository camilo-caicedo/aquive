'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

/**
 * El caparazón de una pantalla interceptada.
 *
 * Sirve para que tocar una tarjeta abra la ficha encima de la lista en vez
 * de reemplazarla: la lista se queda montada detrás, con su scroll y sus
 * filtros, y cerrar devuelve exactamente al sitio donde se estaba.
 *
 * ⚠ La URL cambia igual. Esto va dentro de una ruta interceptora
 * (`app/@modal/(.)…`), así que `/servicios/<id>` sigue siendo una
 * dirección real: pegada en WhatsApp o abierta desde cero sirve la
 * pantalla entera, sin modal. La intercepción solo ocurre cuando ya se
 * estaba dentro de la aplicación, que es justo cuando reemplazar la
 * pantalla estorba.
 *
 * Es el `<dialog>` del navegador y no un `div` con `position: fixed`: la
 * captura del foco, `Escape`, el fondo y quedar por encima de todo —capa
 * superior, sin pelear con ningún `z-index`— los da el navegador. Escritos
 * a mano, la parte que siempre falta es la del foco, y es la que decide si
 * esto se puede usar con lector de pantalla.
 */
export function HojaModal({
  etiqueta,
  variante = 'hoja',
  children,
}: {
  /** Qué es, para quien no ve la pantalla. */
  etiqueta: string
  /** `hoja` sube desde abajo y deja ver la lista; `pantalla` la tapa entera. */
  variante?: 'hoja' | 'pantalla'
  children: ReactNode
}) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo?.open) dialogo?.showModal()
    // Sin esto la lista de atrás sigue moviéndose bajo el dedo mientras la
    // hoja está abierta, y al cerrar aparece en otro sitio.
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previo
    }
  }, [])

  // Cerrar es volver: la entrada anterior de la historia es la lista, así
  // que la URL y lo que se ve vuelven juntos. Vale para la equis, para
  // `Escape` y para tocar el fondo, porque los tres terminan en `close`.
  return (
    <dialog
      ref={ref}
      aria-label={etiqueta}
      onClose={() => router.back()}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close()
      }}
      className={
        variante === 'hoja'
          ? 'animar-hoja m-0 mt-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-3xl bg-background p-0 text-foreground backdrop:bg-foreground/40 sm:mx-auto sm:my-auto sm:max-h-[88dvh] sm:rounded-3xl'
          : 'animar-hoja m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain bg-background p-0 text-foreground backdrop:bg-foreground/40'
      }
    >
      {/* El asa. No hace nada —cerrar es la equis, `Escape` o el fondo—,
          pero es lo que dice que esto se puede cerrar sin haberlo probado. */}
      {variante === 'hoja' && (
        <div className="sticky top-0 z-10 flex justify-center bg-background pt-2 pb-1">
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-border" />
        </div>
      )}
      {children}
    </dialog>
  )
}
