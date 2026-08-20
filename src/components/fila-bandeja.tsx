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

/** Salvia para lo que va bien, arena para lo que espera algo. Nunca solo
 *  color: el sello lleva su texto (regla 9). */
function claseEstado(estado: EstadoConversacion) {
  return estado === 'abierta' || estado === 'acordada' || estado === 'entregada'
    ? 'bg-ok-suave text-ok'
    : 'bg-accent text-accent-foreground'
}

/**
 * Una conversación en la bandeja de coordinación.
 *
 * Es una fila y no una tarjeta con dos botones porque quien coordina mira
 * quince a la vez y necesita comparar: código, lugar, quién, estado y
 * cuándo fue lo último, todo en el mismo sitio de cada fila.
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
  /** Municipio y barrio. */
  lugar: string
  /** Quién ofrece y quién coordina, ya redactado. */
  quien: string
  estado: EstadoConversacion
  /** El último mensaje, recortado a una línea. */
  ultimo?: string | null
  /** Cuándo fue: «hace 2 h». */
  hora?: string | null
  /** Un botón que va aparte del enlace, como «Hacerme cargo». */
  accion?: React.ReactNode
}) {
  return (
    <li className="rounded-2xl bg-card shadow-sm">
      <Link
        href={href}
        className="flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-muted"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-bold">{codigo}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${claseEstado(estado)}`}
            >
              {ETIQUETA_ESTADO[estado]}
            </span>
            {hora && <span className="text-sm text-muted-foreground">{hora}</span>}
          </span>
          <span className="mt-0.5 block truncate text-base">{lugar}</span>
          <span className="block truncate text-sm text-muted-foreground">{quien}</span>
          {ultimo && (
            <span className="mt-0.5 block truncate text-sm text-muted-foreground">{ultimo}</span>
          )}
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
      {accion && <div className="px-4 pb-3">{accion}</div>}
    </li>
  )
}
