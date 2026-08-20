import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

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
 *
 * ⚠ El estado de una sección se dice con un sello de texto —«Sin
 * verificar», «Falta el teléfono»— y no con un círculo de color. Un anillo
 * verde a la izquierda de cada fila convierte la pantalla en una lista de
 * casillas y no dice qué falta; además el color solo no puede ser la señal
 * (regla 9). El sello va en arena o en terracota tenue, nunca en relleno
 * primario: eso es de la acción principal.
 */
export function SeccionPlegable({
  titulo,
  resumen,
  sello,
  abierta,
  children,
  accion,
}: {
  titulo: string
  /** Lo que se lee cuando está cerrada. Sin esto, plegar es esconder. */
  resumen?: ReactNode
  /** Estado en palabras: «Sin verificar», «Falta tu autorización». */
  sello?: ReactNode
  /** Abierta de entrada. La primera sin terminar, normalmente. */
  abierta?: boolean
  /** Lo que va al pie de la sección: casi siempre su propio «Guardar». */
  accion?: ReactNode
  children: ReactNode
}) {
  return (
    <details open={abierta} className="group rounded-2xl bg-card shadow-sm">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">{titulo}</span>
          {/* El resumen se esconde al abrir: dentro ya está el dato de
              verdad, y repetirlo arriba solo hace ruido. */}
          {resumen && (
            <span className="block truncate text-base text-muted-foreground group-open:hidden">
              {resumen}
            </span>
          )}
        </span>
        {sello && (
          <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
            {sello}
          </span>
        )}
        <ChevronDown
          className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-4 px-4 pt-1 pb-4">
        {children}
        {accion}
      </div>
    </details>
  )
}
