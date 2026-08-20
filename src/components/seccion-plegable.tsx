import type { ReactNode } from 'react'
import { ChevronDown, Check, CircleAlert } from 'lucide-react'

/**
 * Una sección de formulario que se abre y se cierra, sobre `<details>` y
 * `<summary>` nativos (regla 6).
 *
 * Nativo y no un acordeón de librería a propósito: cero JavaScript, abre y
 * cierra sin hidratar, el teclado y el lector de pantalla vienen de fábrica,
 * y el contenido cerrado sigue estando en el HTML servido —lo que importa
 * para un formulario que se envía sin JS—.
 *
 * Cerrada enseña su resumen, que es lo que evita el otro fallo: un
 * formulario plegado donde no se ve qué falta obliga a abrir las seis
 * secciones para saber por qué no deja guardar.
 */
export function SeccionPlegable({
  titulo,
  resumen,
  completa,
  abierta,
  children,
  accion,
}: {
  titulo: string
  /** Lo que se lee cuando está cerrada. Sin esto, plegar es esconder. */
  resumen?: ReactNode
  /** `true` pinta el visto en salvia; `false`, el aviso de que falta algo. */
  completa?: boolean
  /** Abierta de entrada. La primera sin terminar, normalmente. */
  abierta?: boolean
  /** Lo que va al pie de la sección: casi siempre su propio «Guardar». */
  accion?: ReactNode
  children: ReactNode
}) {
  return (
    <details
      open={abierta}
      className="group rounded-xl border border-border bg-card open:shadow-sm"
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        {completa !== undefined && (
          <span
            aria-hidden="true"
            className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
              completa ? 'bg-ok-suave text-ok' : 'bg-muted text-muted-foreground'
            }`}
          >
            {completa ? <Check className="size-4" /> : <CircleAlert className="size-4" />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium">{titulo}</span>
          {/* El resumen se esconde al abrir: dentro ya está el dato de
              verdad, y repetirlo arriba solo hace ruido. */}
          {resumen && (
            <span className="block truncate text-sm text-muted-foreground group-open:hidden">
              {resumen}
            </span>
          )}
          {/* Para quien no ve el icono: el estado no puede depender del
              color ni de una forma (regla 9). */}
          {completa !== undefined && (
            <span className="sr-only">{completa ? 'Completa' : 'Falta información'}</span>
          )}
        </span>
        <ChevronDown
          className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-4 border-t border-border px-4 py-4">
        {children}
        {accion}
      </div>
    </details>
  )
}
