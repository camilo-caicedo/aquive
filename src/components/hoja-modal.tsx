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
  children,
}: {
  /** Qué es, para quien no ve la pantalla. */
  etiqueta: string
  children: ReactNode
}) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const abrir = () => {
      const dialogo = ref.current
      if (dialogo && !dialogo.open) dialogo.showModal()
    }
    abrir()

    // ⚠ `pageshow` no es paranoia. Desde la hoja se puede salir del sitio
    // —«Entrar con Google» se lleva el navegador entero— y al volver con la
    // flecha atrás la página se restaura de la caché sin re-montar nada.
    // El navegador NO conserva la capa superior en esa caché, así que el
    // diálogo vuelve cerrado: la hoja desaparece, la URL sigue diciendo que
    // está abierta y no queda nada que tocar.
    window.addEventListener('pageshow', abrir)
    return () => window.removeEventListener('pageshow', abrir)
  }, [])

  // Cerrar es volver: la entrada anterior de la historia es la lista, así
  // que la URL y lo que se ve vuelven juntos.
  //
  // ⚠ Va en `cancel` y en el clic del fondo, y NO en `close`. `close` lo
  // dispara también el navegador —al restaurar de la caché, al descargar la
  // página—, y ahí un `router.back()` es una navegación que nadie pidió.
  // Estos dos solo ocurren cuando alguien los provoca.
  const cerrar = () => router.back()

  return (
    <dialog
      ref={ref}
      aria-label={etiqueta}
      onCancel={(e) => {
        e.preventDefault()
        cerrar()
      }}
      onClick={(e) => {
        if (e.target === ref.current) cerrar()
      }}
      className="animar-hoja m-0 mt-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-3xl bg-background p-0 text-foreground backdrop:bg-foreground/40 sm:mx-auto sm:my-auto sm:max-h-[88dvh] sm:rounded-3xl"
    >
      {/* El asa. No hace nada —cerrar es `Escape`, la flecha de volver o el
          fondo—, pero es lo que dice que esto se puede cerrar sin haberlo
          probado. */}
      <div className="flex shrink-0 justify-center pt-2 pb-1">
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-border" />
      </div>
      {children}
    </dialog>
  )
}
