'use client'

import { useState } from 'react'

import { rpc } from '@/orpc/cliente'
import { precioLegible } from '@/lib/servicios'
import { Button } from '@/components/ui/button'
import { SelloEstadoSolicitud } from '@/components/sello-estado-solicitud'
import type { Autor, OrdenDelChat } from '@/contrato/chat'
import type { EstadoSolicitud } from '@/contrato/servicios'

/**
 * A qué puede pasar cada estado, y con qué texto de botón. Gemela de
 * `src/server/servicios/transiciones.ts`: el servidor vuelve a comprobar el
 * salto antes de moverlo, así que un botón que se muestre de más nunca
 * mueve nada por sí solo.
 */
const SIGUIENTES: Partial<
  Record<EstadoSolicitud, { estado: EstadoSolicitud; etiqueta: string; variant?: 'outline' | 'ghost' }[]>
> = {
  pendiente: [
    { estado: 'aceptada', etiqueta: 'Aceptar', variant: 'outline' },
    { estado: 'rechazada', etiqueta: 'Rechazar', variant: 'ghost' },
  ],
  aceptada: [
    { estado: 'realizada', etiqueta: 'Marcar realizada', variant: 'outline' },
    { estado: 'no_concretada', etiqueta: 'No se concretó', variant: 'ghost' },
  ],
}

/**
 * La orden que abrió este hilo (ADR 0017), fija arriba de la conversación:
 * qué se pidió, con qué precio y en qué estado — para los dos lados.
 *
 * Los botones de transición solo los ve el prestador (`soy === 'ofrece'`):
 * es su ficha la que gestiona la orden, y aquí mismo es donde se acuerda,
 * en vez de en una segunda pantalla compitiendo con esta.
 */
export function TarjetaOrdenChat({
  solicitudId,
  soy,
  orden: inicial,
}: {
  solicitudId: string
  soy: Autor
  orden: OrdenDelChat
}) {
  const [orden, setOrden] = useState(inicial)
  const [moviendo, setMoviendo] = useState<EstadoSolicitud | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function mover(estado: EstadoSolicitud) {
    setMoviendo(estado)
    setError(null)
    try {
      await rpc.servicios.cambiarEstadoSolicitud({ id: solicitudId, estado })
      setOrden((o) => ({ ...o, estado }))
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo. Inténtalo otra vez.')
    } finally {
      setMoviendo(null)
    }
  }

  const siguientes = soy === 'ofrece' ? (SIGUIENTES[orden.estado] ?? []) : []

  return (
    <div className="shadow-canto sticky top-0 z-10 mb-3 rounded-2xl bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-heading text-lg leading-tight">{orden.oficio}</h2>
        <SelloEstadoSolicitud estado={orden.estado} />
      </div>

      {orden.modo && (
        <p className="mt-0.5 text-base">{precioLegible(orden.modo, orden.precio_desde, orden.unidad)}</p>
      )}
      {orden.detalle && <p className="mt-1 text-base">{orden.detalle}</p>}
      {orden.nota && <p className="mt-1 text-base text-muted-foreground">{orden.nota}</p>}

      {siguientes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {siguientes.map((s) => (
            <Button
              key={s.estado}
              variant={s.variant}
              disabled={moviendo !== null}
              onClick={() => mover(s.estado)}
            >
              {moviendo === s.estado ? 'Guardando…' : s.etiqueta}
            </Button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
