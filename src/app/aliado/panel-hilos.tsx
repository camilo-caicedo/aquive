'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Chat } from '@/components/chat'
import type { ConversacionDetalle, EstadoConversacion, HiloResumen } from '@/lib/types'

const ETIQUETA_ESTADO: Record<EstadoConversacion, string> = {
  esperando_aliado: 'Sin fundación disponible',
  asignada: 'Falta que alguien se haga cargo',
  abierta: 'Abierta',
  acordada: 'Acordada',
  entregada: 'Entregada',
  cerrada: 'Cerrada',
}

/**
 * Los hilos de una cuenta: los suyos como quien ofrece, y los de las
 * organizaciones donde es miembro activo. Es la misma lista para los dos
 * papeles porque `mis_hilos()` ya resuelve cuál es cuál.
 *
 * El hilo se abre bajo demanda y no todos a la vez: cada uno es una
 * consulta con sus mensajes, y en un albergue con señal mala cargar
 * quince conversaciones para leer una es una crueldad.
 */
export function PanelHilos({ hilos }: { hilos: HiloResumen[] }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState<ConversacionDetalle | null>(null)
  const [cargando, setCargando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function abrir(id: string) {
    setCargando(id)
    setError(null)
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('leer_conversacion', {
      p_conversacion_id: id,
    })
    if (rpcError) {
      setError(rpcError.message)
      setCargando(null)
      return
    }
    setAbierto(data as unknown as ConversacionDetalle)
    setCargando(null)
  }

  async function hacerseCargo(id: string) {
    setCargando(id)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('asignar_aliado', {
      p_conversacion_id: id,
    })
    if (rpcError) {
      setError(rpcError.message)
      setCargando(null)
      return
    }
    setCargando(null)
    router.refresh()
    await abrir(id)
  }

  if (hilos.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-border p-6 text-center text-base text-muted-foreground">
        No hay conversaciones todavía.
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hilos.map((h) => (
        <div key={h.id} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-lg font-bold">{h.codigo}</span>
            <span
              className={
                h.estado === 'abierta' || h.estado === 'acordada'
                  ? 'inline-flex shrink-0 items-center rounded-full border border-ok/30 bg-ok-suave px-2.5 py-0.5 text-base font-medium text-ok'
                  : 'inline-flex shrink-0 items-center rounded-full border border-primary/25 bg-accent px-2.5 py-0.5 text-base font-medium text-accent-foreground'
              }
            >
              {ETIQUETA_ESTADO[h.estado]}
            </span>
          </div>

          <p className="mt-1 text-base text-muted-foreground">
            {h.municipio} — {h.barrio}
          </p>
          <p className="mt-1 text-base text-muted-foreground">
            {h.soy_ofertador ? 'Ofreciste tú' : `Ofrece ${h.ofertador ?? 'alguien'}`}
            {h.aliado ? ` · coordina ${h.aliado}` : ''} · {h.mensajes_total}{' '}
            {h.mensajes_total === 1 ? 'mensaje' : 'mensajes'}
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              disabled={cargando === h.id}
              onClick={() => (abierto?.id === h.id ? setAbierto(null) : abrir(h.id))}
            >
              {abierto?.id === h.id ? 'Cerrar' : 'Ver conversación'}
            </Button>

            {/* Solo para quien puede: `asignar_aliado` exige ser miembro
                activo de la organización, y la RPC lo vuelve a comprobar. */}
            {h.sin_asignar && !h.soy_ofertador && (
              <Button disabled={cargando === h.id} onClick={() => hacerseCargo(h.id)}>
                {cargando === h.id ? 'Un momento…' : 'Hacerme cargo'}
              </Button>
            )}
          </div>

          {abierto?.id === h.id && (
            <div className="mt-3">
              <Chat
                conversacionId={abierto.id}
                estado={abierto.estado}
                miRol={abierto.mi_rol}
                acopio={abierto.acopio}
                mensajesIniciales={abierto.mensajes}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
