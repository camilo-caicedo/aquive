import { CheckCircle2, Clock, MinusCircle, XCircle, type LucideIcon } from 'lucide-react'

import type { EstadoSolicitud } from '@/contrato/servicios'

/**
 * Los cinco estados de una orden (ADR 0017), con su sello, su texto y su
 * icono. Nunca solo el color (accesibilidad de `CLAUDE.md`).
 *
 * Compartido entre `/perfil/solicitudes-recibidas` y la tarjeta del chat:
 * antes vivía copiado a mano en la lista, y una copia sola se habría
 * desincronizado el día que cambiara un color o una etiqueta.
 */
export const ESTADOS_SOLICITUD: Record<
  EstadoSolicitud,
  { etiqueta: string; clase: string; Icono: LucideIcon }
> = {
  pendiente: { etiqueta: 'Pendiente', clase: 'bg-accent text-accent-foreground', Icono: Clock },
  aceptada: { etiqueta: 'Aceptada', clase: 'bg-ok-suave text-foreground', Icono: CheckCircle2 },
  realizada: {
    etiqueta: 'Realizada',
    clase: 'bg-ok-suave text-foreground',
    Icono: CheckCircle2,
  },
  rechazada: {
    etiqueta: 'Rechazada',
    clase: 'bg-destructive/10 text-destructive',
    Icono: XCircle,
  },
  no_concretada: {
    etiqueta: 'No concretada',
    clase: 'bg-secondary text-secondary-foreground',
    Icono: MinusCircle,
  },
}

export function SelloEstadoSolicitud({ estado }: { estado: EstadoSolicitud }) {
  const { etiqueta, clase, Icono } = ESTADOS_SOLICITUD[estado]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${clase}`}
    >
      <Icono className="size-4" aria-hidden="true" />
      {etiqueta}
    </span>
  )
}
