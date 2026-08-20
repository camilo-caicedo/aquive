import Link from 'next/link'
import { MessageSquare, Check, HeartHandshake, Info } from 'lucide-react'
import type { Categoria, FlujoSolicitud, ItemResumen } from '@/lib/types'
import { categoria, describirItem } from '@/lib/catalogo'
import { BadgeFrescura } from '@/components/badge-frescura'
import { Button } from '@/components/ui/button'

// Cuántos chips de ítem se ven antes de resumir en «+N». Tres caben en una
// línea a 360 px; a partir de ahí la tarjeta se convierte en una lista de
// compra y deja de poder mirarse de un vistazo.
const CHIPS_VISIBLES = 3

// Solo lo que la tarjeta usa, y no la fila entera de la vista: así sirve
// igual para el tablero y para el cruce inverso, cuya RPC devuelve las
// mismas columnas más `coincidencias` y sin los arreglos de identificadores.
interface Solicitud {
  codigo: string
  categoria: Categoria
  municipio_nombre: string
  barrio: string
  nota: string | null
  expira_at: string
  horas_sin_confirmar: number
  num_respuestas: number
  items: ItemResumen[]
  // Opcional: el cruce inverso devuelve las mismas columnas menos esta.
  flujo?: FlujoSolicitud
  /** Nota del proyecto, no de quien pidio. Opcional por lo mismo. */
  nota_admin?: string | null
}

/**
 * Una solicitud en una lista: cinco datos y una acción (regla 7).
 *
 * Qué es —la categoría, como título—, dónde, cuándo, el estado y el botón.
 * El resto vive en el detalle.
 *
 * Lo que salió de aquí y por qué:
 *
 * - El código. A quien mira el tablero no le dice nada: es la llave de
 *   quien pidió, y ocupaba el renglón más visible de la tarjeta. Sigue
 *   entero en el detalle y en «Lo mío».
 * - El tiempo se decía dos veces —`formatearHoras` abajo y `BadgeFrescura`
 *   arriba— con dos redacciones distintas del mismo número.
 * - «Se borra sola en N horas» se decía además del sello de frescura. Una
 *   sola señal de tiempo.
 * - El enlace «Cómo cuidarte antes de una entrega» se decía en cada
 *   tarjeta: repetido veinte veces se vuelve textura y deja de leerse. Va
 *   una vez encima de la lista y entero en `/responder`, que es donde se
 *   decide (regla 5).
 *
 * Lo que se queda porque dice algo que nadie más dice: el sello de
 * acompañamiento y la nota del administrador.
 */
export function TarjetaSolicitud({
  solicitud,
  coincidencias,
}: {
  solicitud: Solicitud
  coincidencias?: number
}) {
  const { etiqueta, Icono } = categoria(solicitud.categoria)
  const visibles = solicitud.items.slice(0, CHIPS_VISIBLES)
  const ocultos = solicitud.items.length - visibles.length

  return (
    <li
      className={`animar-entrada overflow-hidden rounded-2xl bg-card shadow-sm transition-shadow hover:shadow-md ${
        coincidencias ? 'border border-primary/40' : ''
      }`}
    >
      {/* La coincidencia va arriba y a lo ancho, no como un chip perdido en
          medio: es exactamente lo que la persona vino a ver, y en el cruce
          inverso decide si sigue leyendo la tarjeta o pasa a la siguiente. */}
      {coincidencias !== undefined && coincidencias > 0 && (
        <p className="flex items-center gap-1.5 bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          {coincidencias === 1
            ? 'Pide una de las cosas que marcaste'
            : `Pide ${coincidencias} de las cosas que marcaste`}
        </p>
      )}

      <div className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          {/* Círculo, no cuadrado redondeado: es el mismo gesto que el
              avatar de un contacto, y a 40 px se distingue mejor. */}
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Icono className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-lg leading-tight font-bold">{etiqueta}</p>
            <p className="mt-0.5 truncate text-base text-muted-foreground">
              {solicitud.municipio_nombre} · {solicitud.barrio}
            </p>
          </div>
        </div>
        <BadgeFrescura horas={solicitud.horas_sin_confirmar} />
      </div>

      {/* Dos líneas y corta: la nota completa está en /responder. Cuatro
          párrafos en una tarjeta empujan la siguiente solicitud fuera de
          pantalla. */}
      {solicitud.nota && (
        <p className="mt-3 line-clamp-2 text-base">{solicitud.nota}</p>
      )}

      {visibles.length > 0 && (
        <ul className="mt-3 flex flex-wrap items-center gap-2">
          {visibles.map((it, i) => (
            <li
              key={i}
              className="rounded-full bg-muted px-3.5 py-1.5 text-sm text-foreground"
            >
              {describirItem(it)}
            </li>
          ))}
          {ocultos > 0 && (
            <li className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
              +{ocultos}
            </li>
          )}
        </ul>
      )}

      {/* Sello discreto, no un distintivo de categoría: dice que hay una
          fundación coordinando, y nada más. Ni cuál, ni de quién es la
          solicitud. Va en salvia con icono y texto, nunca solo color. */}
      {solicitud.flujo === 'acompanado' && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-ok">
          <HeartHandshake className="size-4 shrink-0" aria-hidden="true" />
          Una fundación acompaña esta entrega
        </p>
      )}

      {/* Esto lo escribe AquíVe, no quien pidió, así que se distingue del
          resto de la tarjeta — mismo criterio que el sello de «una fundación
          acompaña esta entrega». Sirve para decir «esto ya está resuelto» y
          que no se movilicen tres personas por lo mismo. */}
      {solicitud.nota_admin && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-secondary px-2.5 py-2 text-base text-secondary-foreground">
          <Info className="size-4 shrink-0 translate-y-1" aria-hidden="true" />
          <span>{solicitud.nota_admin}</span>
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 text-base text-muted-foreground">
          <MessageSquare className="size-5 shrink-0" aria-hidden="true" />
          <span className={solicitud.num_respuestas > 0 ? 'font-medium text-foreground' : undefined}>
            {solicitud.num_respuestas === 0
              ? 'Sin respuestas'
              : `${solicitud.num_respuestas} ${
                  solicitud.num_respuestas === 1 ? 'respuesta' : 'respuestas'
                }`}
          </span>
        </p>
        <Button
          variant="outline"
          className="shrink-0 border-primary text-primary"
          nativeButton={false}
          render={<Link href={`/responder/${solicitud.codigo}`} />}
        >
          Puedo ayudar
        </Button>
      </div>
      </div>
    </li>
  )
}
