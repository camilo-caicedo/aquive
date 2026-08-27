import Link from 'next/link'
import { MessagesSquare } from 'lucide-react'

import type { Origen } from '@/contrato/chat'

/**
 * Abrir el chat de aquí dentro, al lado de WhatsApp y de llamar.
 *
 * Tercer control y no el primero, a propósito: quien publicó una ficha o un
 * producto puso su teléfono queriendo, y para esa persona WhatsApp sigue
 * siendo lo natural. Este botón es para el otro lado — quien quiere
 * preguntar sin entregar su número, que hasta ahora no tenía forma de
 * hacerlo fuera de los servicios.
 *
 * Redondo y con etiqueta accesible en vez de texto: en una tarjeta de lista
 * caben una acción ancha y dos redondas (regla de interfaz 7), y tres
 * botones con palabra obligan a leer para elegir lo que casi siempre es lo
 * mismo.
 */
export function BotonChat({
  origen,
  etiqueta,
  className = '',
}: {
  origen: Origen
  /** Qué se abre y con quién. Se lee en voz alta, así que va completa. */
  etiqueta: string
  className?: string
}) {
  return (
    <Link
      href={`/chat/${origen.tipo}/${origen.id}`}
      aria-label={etiqueta}
      className={`border-enlace text-enlace hover:bg-accent flex size-12 shrink-0 items-center justify-center rounded-full border transition-colors ${className}`}
    >
      <MessagesSquare className="size-5" aria-hidden="true" />
    </Link>
  )
}
