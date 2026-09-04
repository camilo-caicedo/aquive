'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'

/**
 * El aviso de que algo salió bien.
 *
 * ⚠ Esto faltaba en toda la aplicación. Había treinta y nueve llamadas a
 * `router.refresh()` después de guardar y **ninguna decía nada**: la pantalla
 * se volvía a pintar con los mismos valores y no había forma de saber si
 * quedó. Con señal mala eso se resuelve tocando «Guardar» otra vez, que es
 * exactamente lo que no queremos que pase.
 *
 * ⚠ Solo lo que salió bien. Los errores se quedan donde ya están —en línea,
 * junto al campo que hay que corregir— porque un error que se va solo a los
 * cuatro segundos es peor que uno que se queda: obliga a repetir la acción
 * para volver a leerlo.
 */
const Contexto = createContext<(texto: string) => void>(() => {})

/**
 * `avisar('Guardado')`. El texto dice QUÉ pasó, no «Listo»: quien acaba de
 * tocar tres botones seguidos necesita saber cuál de los tres respondió.
 */
export function useAviso() {
  return useContext(Contexto)
}

/** Cuánto se queda. Cuatro segundos largos: el público lee despacio. */
const DURACION = 4200

/**
 * Dónde montarlo.
 *
 * ⚠ Esto resuelve lo mismo que `ContenedorHoja` para los desplegables, y por
 * la misma razón. Varios formularios que guardan viven dentro de un
 * `HojaModal`, que es un `<dialog>` abierto con `showModal()` y por tanto en
 * la *capa superior* del navegador. Un aviso montado en el `body` queda
 * debajo: se comprobó con `elementFromPoint` sobre el aviso ya abierto y con
 * el modal delante, y lo que devolvía era el contenido del diálogo.
 *
 * Con un modal abierto el aviso se monta DENTRO de él y viaja con él a la
 * capa superior. Sin modal, en el `body` como cualquier otra cosa.
 */
function dondeMontar(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const modal = document.querySelector('dialog[open]')
  return modal instanceof HTMLElement ? modal : document.body
}

export function ProveedorDeAvisos({ children }: { children: ReactNode }) {
  // El `id` va aparte del texto para que dos avisos con el MISMO texto
  // seguidos vuelvan a montar la caja. Sin él, guardar dos veces la misma
  // sección no reabriría nada y parecería que el segundo no guardó.
  const [aviso, setAviso] = useState<{
    texto: string
    id: number
    destino: HTMLElement | null
  } | null>(null)
  const caja = useRef<HTMLDivElement>(null)

  const avisar = useCallback((texto: string) => {
    setAviso({ texto, id: Date.now(), destino: dondeMontar() })
  }, [])

  useEffect(() => {
    if (!aviso) return
    const el = caja.current
    try {
      // `manual` y no `auto`: un popover automático se cierra al tocar
      // cualquier parte de la pantalla, y aquí el toque siguiente suele ser
      // en el formulario que se acaba de guardar.
      if (el && !el.matches(':popover-open')) el.showPopover()
    } catch {
      // Un navegador sin `popover` no revienta: la caja se queda en el flujo
      // normal del documento y se lee igual.
    }
    const t = setTimeout(() => setAviso(null), DURACION)
    return () => clearTimeout(t)
  }, [aviso])

  return (
    <Contexto.Provider value={avisar}>
      {children}
      {aviso?.destino &&
        createPortal(
          <div
            key={aviso.id}
            ref={caja}
            popover="manual"
            // `status`, no `alert`: es una confirmación, no una interrupción,
            // y un lector de pantalla no tiene por qué cortar lo que esté
            // leyendo.
            role="status"
            aria-live="polite"
            // ⚠ `top-auto` no es de adorno: un popover abierto trae
            // `inset: 0` del navegador, y ese `top: 0` gana sobre el `bottom`
            // de aquí y sube el aviso a la esquina de arriba, lejos del
            // pulgar. Va encima del hueco que el `body` ya reserva para la
            // barra inferior, que es fija en el teléfono.
            className="animar-entrada fixed inset-x-0 top-auto bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 m-0 mx-auto w-[min(28rem,calc(100%-2rem))] border-0 bg-transparent p-0 sm:bottom-6"
          >
            <div className="shadow-cartel-verde flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
              <span className="bg-ok-suave text-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                <Check className="size-5" aria-hidden="true" />
              </span>
              <p className="min-w-0 flex-1 text-base font-medium">{aviso.texto}</p>
              {/* 48 px, como toda área táctil (accesibilidad de CLAUDE.md). */}
              <button
                type="button"
                onClick={() => setAviso(null)}
                aria-label="Cerrar el aviso"
                className="-mr-2 flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>,
          aviso.destino,
        )}
    </Contexto.Provider>
  )
}
