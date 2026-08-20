'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FilaBandeja } from '@/components/fila-bandeja'
import type { HiloResumen } from '@/lib/types'

/**
 * Los hilos de una cuenta: los suyos como quien ofrece, y los de las
 * organizaciones donde es miembro activo. Es la misma lista para los dos
 * papeles porque `mis_hilos()` ya resuelve cuál es cuál.
 *
 * ⚠ Esto ya no dibuja el chat. Antes lo desplegaba dentro de la lista: la
 * fila que estabas mirando se movía bajo el dedo al abrir otra, y había
 * tres desplazamientos anidados. Ahora cada hilo tiene su ruta,
 * `/aliado/conversacion/[id]`, y `leer_conversacion` la pide allá — bajo
 * demanda, igual que antes, con los mismos argumentos.
 */
export function PanelHilos({ hilos }: { hilos: HiloResumen[] }) {
  const router = useRouter()
  const [cargando, setCargando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  }

  return (
    <div className="mt-3">
      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ul className="space-y-2">
        {hilos.map((h) => (
          <FilaBandeja
            key={h.id}
            href={`/aliado/conversacion/${h.id}`}
            codigo={h.codigo}
            lugar={`${h.municipio} · ${h.barrio}`}
            quien={
              // La rama directa va primero: en ese hilo no hay ofertador, y
              // decir «ofrece alguien» sería inventarse una persona.
              (h.directa
                ? 'Lo entrega la fundación'
                : h.soy_ofertador
                  ? 'Ofreciste tú'
                  : `Ofrece ${h.ofertador ?? 'alguien'}`) +
              (h.aliado ? ` · coordina ${h.aliado}` : '')
            }
            estado={h.estado}
            ultimo={`${h.mensajes_total} ${h.mensajes_total === 1 ? 'mensaje' : 'mensajes'}`}
            accion={
              // Solo para quien puede: `asignar_aliado` exige ser miembro
              // activo de la organización, y la RPC lo vuelve a comprobar.
              h.sin_asignar && !h.soy_ofertador ? (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={cargando === h.id}
                  onClick={() => hacerseCargo(h.id)}
                >
                  {cargando === h.id ? 'Un momento…' : 'Hacerme cargo'}
                </Button>
              ) : undefined
            }
          />
        ))}
      </ul>
    </div>
  )
}
