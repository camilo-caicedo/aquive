import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { EstadoConversacion } from '@/lib/types'

export const ETIQUETA_ESTADO: Record<EstadoConversacion, string> = {
  esperando_aliado: 'Sin fundación',
  asignada: 'Sin dueño',
  abierta: 'Abierta',
  acordada: 'Acordada',
  entregada: 'Entregada',
  cerrada: 'Cerrada',
}

/** Si la conversación va andando o está esperando a alguien. */
function enMarcha(estado: EstadoConversacion) {
  return estado === 'abierta' || estado === 'acordada' || estado === 'entregada'
}

/** Verde pálido para lo que va bien, amarillo pálido para lo que espera
 *  algo. Nunca solo color: el sello lleva su texto (regla 9). */
function claseEstado(estado: EstadoConversacion) {
  return enMarcha(estado)
    ? 'bg-ok-suave text-foreground'
    : 'bg-accent text-accent-foreground'
}

/**
 * La cinta de arriba y la sombrilla de cartel, en el gajo del estado.
 *
 * ⚠ El color va con la palabra siempre: la cinta lleva el código y el
 * sello lleva el estado escrito. Sin eso sería un código de color que hay
 * que aprenderse, y esto se usa de pie y con prisa.
 */
function claseCartel(estado: EstadoConversacion) {
  return enMarcha(estado) ? 'shadow-cartel-verde' : 'shadow-cartel-amarillo'
}

function claseCinta(estado: EstadoConversacion) {
  return enMarcha(estado) ? 'bg-familia-verde' : 'bg-familia-amarillo'
}

/**
 * Una conversación en la bandeja de coordinación.
 *
 * Cinco datos y una acción (regla 7): código, lugar, quiénes, estado y
 * cuándo fue lo último. Quien coordina mira quince a la vez y necesita
 * comparar, así que todo cae en el mismo sitio de cada tarjeta.
 *
 * La cinta de color es del estado, no de la urgencia: verde lo que va
 * andando, amarillo lo que espera a alguien. Nunca informa sola — el sello
 * de la derecha lleva la palabra.
 *
 * La que pide una acción lleva su botón debajo de la línea; las demás se
 * abren tocando la tarjeta entera.
 *
 * ⚠ Toda la fila es el enlace al hilo, que vive en su propia ruta. Antes el
 * chat se desplegaba dentro de la lista: abrir uno empujaba los demás hacia
 * abajo, así que la fila que estabas mirando se movía bajo el dedo, y al
 * cerrar habías perdido el sitio. `leer_conversacion` se sigue pidiendo
 * bajo demanda —ahora la pide la ruta del hilo—, así que la consulta es la
 * misma.
 */
export function FilaBandeja({
  href,
  codigo,
  lugar,
  quien,
  estado,
  ultimo,
  hora,
  accion,
}: {
  href: string
  codigo: string
  /** Municipio y categoría, que es como se reconoce la solicitud. */
  lugar: string
  /** Quién ofrece y quién coordina, ya redactado. */
  quien: string
  estado: EstadoConversacion
  /** Lo último que pasó, recortado a una línea. */
  ultimo?: string | null
  /** Cuándo fue: «hace 2 h». */
  hora?: string | null
  /** Un botón que va aparte del enlace, como «Hacerme cargo». */
  accion?: React.ReactNode
}) {
  return (
    <li className={`overflow-hidden rounded-2xl bg-card ${claseCartel(estado)}`}>
      <Link
        href={href}
        className="block transition-transform active:translate-x-0.5 active:translate-y-0.5"
      >
        {/* La cinta del cartel: el código a la izquierda —es lo que se dice
            en voz alta por teléfono para nombrar una entrega— y el estado
            escrito a la derecha. Sobre el gajo va tinta negra; los cuatro
            colores de la sombrilla pasan AA con negro encima. */}
        <span
          className={`flex items-center justify-between gap-2 px-4 py-2 text-foreground ${claseCinta(estado)}`}
        >
          <span className="font-mono text-sm font-bold tracking-[0.085em] uppercase">
            {codigo}
          </span>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold ${claseEstado(estado)}`}
          >
            {ETIQUETA_ESTADO[estado]}
          </span>
        </span>

        <span className="block px-4 pt-3 pb-3.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate font-heading text-lg leading-tight">
              {lugar}
            </span>
            {hora && (
              <span className="shrink-0 text-sm text-muted-foreground">{hora}</span>
            )}
          </span>
          <span className="mt-1 block text-base">{quien}</span>
          {/* Debajo de una línea de pelo, con «Abrir» en azul a la derecha:
              es lo único de la tarjeta que dice «esto se puede tocar». */}
          <span className="mt-2.5 flex items-center gap-2 border-t border-border pt-2.5">
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {ultimo}
            </span>
            <span className="flex shrink-0 items-center gap-0.5 text-base font-bold text-enlace">
              Abrir
              <ChevronRight className="size-4" aria-hidden="true" />
            </span>
          </span>
        </span>
      </Link>
      {accion && <div className="px-4 pb-3.5">{accion}</div>}
    </li>
  )
}
