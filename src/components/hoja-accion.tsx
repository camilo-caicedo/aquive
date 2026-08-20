'use client'

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ContenedorHoja } from '@/components/contenedor-hoja'

const sinSuscripcion = () => () => {}
const enCliente = () => true
const enServidor = () => false

/**
 * Una hoja inferior para hacer algo sin salir de la lista: escribir una
 * respuesta, elegir un motivo de reporte.
 *
 * Hermana de `HojaFiltros`, con la misma maquinaria —`popover` nativo, así
 * que cerrar al tocar fuera, `Escape` y el foco los da el navegador— y el
 * mismo cuidado: los desplegables de dentro se portalizan a la hoja y no al
 * `body`, o quedan bajo la capa superior.
 *
 * Existe porque el formulario se abría dentro de la tarjeta: al desplegarse
 * empujaba el resto de la lista hacia abajo, así que lo que estabas mirando
 * se movía bajo el dedo justo cuando ibas a escribir.
 *
 * ⚠ Sin JavaScript no hay hoja. Quien la use tiene que dejar un camino que
 * funcione igual —un enlace a una pantalla propia—, o aceptar que esa
 * acción es solo para quien tiene JS. Aquí eso vale: responder y reportar
 * ya eran acciones de cliente.
 */
export function HojaAccion({
  id,
  titulo,
  disparador,
  children,
  pie,
}: {
  /** Id del `popover`. Único por pantalla. */
  id: string
  titulo: string
  /** Cómo se abre. Recibe las props que tiene que llevar el botón. */
  disparador: (props: { popoverTarget: string; type: 'button' }) => ReactNode
  children: ReactNode
  /** El pie fijo de la hoja: normalmente el botón que envía. */
  pie?: (cerrar: () => void) => ReactNode
}) {
  const hidratado = useSyncExternalStore(sinSuscripcion, enCliente, enServidor)
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  const [generacion, setGeneracion] = useState(0)

  useEffect(() => {
    if (!panel) return
    const alCerrar = (e: Event) => {
      if ((e as ToggleEvent).newState === 'closed') setGeneracion((g) => g + 1)
    }
    panel.addEventListener('toggle', alCerrar)
    return () => panel.removeEventListener('toggle', alCerrar)
  }, [panel])

  function cerrar() {
    panel?.hidePopover()
  }

  if (!hidratado) return null

  return (
    <>
      {disparador({ popoverTarget: id, type: 'button' })}

      {/* Sin clase de `display`: la hoja del navegador esconde el popover
          cerrado, y una utilidad de autor le ganaría y lo dejaría visible.
          `top-auto` anula el `inset: 0` de esa misma hoja. */}
      <div
        ref={setPanel}
        id={id}
        popover="auto"
        aria-label={titulo}
        className="hoja-inferior fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88vh] w-full max-w-none rounded-t-2xl border-t border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-foreground/40"
      >
        <div className="mx-auto flex max-h-[88vh] max-w-lg flex-col">
          <div className="shrink-0 px-4 pt-2">
            <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-border" />
            <div className="mt-2 flex items-center justify-between gap-3">
              <h2 className="font-heading text-2xl">{titulo}</h2>
              <button
                type="button"
                popoverTarget={id}
                popoverTargetAction="hide"
                aria-label="Cerrar"
                className="-mr-2 flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span aria-hidden="true" className="text-2xl leading-none">
                  ×
                </span>
              </button>
            </div>
          </div>

          <ContenedorHoja.Provider value={panel}>
            <div key={generacion} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {children}
            </div>
          </ContenedorHoja.Provider>

          {pie && (
            <div className="shrink-0 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {pie(cerrar)}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
