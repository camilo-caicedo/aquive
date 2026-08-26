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
export function PanelHilos({
  hilos,
  conColas = true,
  volverA = '/aliado',
}: {
  hilos: HiloResumen[]
  /**
   * Las tres colas son conceptos de quien coordina: «Sin asignar» son los
   * hilos que ninguna persona de la fundación ha tomado todavía.
   *
   * ⚠ Para quien solo ofreció ayuda no significan nada, y la de por
   * defecto —«Sin asignar»— excluye los hilos propios, así que estaba
   * siempre vacía: lo primero que veía era una lista en blanco teniendo
   * conversaciones abiertas. Ver `/coordinacion`.
   */
  conColas?: boolean
  /** A dónde vuelve el hilo que se abra desde aquí. */
  volverA?: string
}) {
  const router = useRouter()
  const [cargando, setCargando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Tres colas sobre la misma lista, no tres listas: lo que cambia es qué
  // se mira, no dónde se mira. La que pide acción va primero y con su
  // número, para no entrar a una cola vacía.
  const [cola, setCola] = useState<'sin_asignar' | 'mias' | 'entregadas'>('sin_asignar')

  const sinAsignar = hilos.filter((h) => h.sin_asignar && !h.soy_ofertador)
  const entregadas = hilos.filter((h) => h.estado === 'entregada' || h.estado === 'cerrada')
  const mias = hilos.filter((h) => !sinAsignar.includes(h) && !entregadas.includes(h))
  const COLAS = [
    { clave: 'sin_asignar' as const, etiqueta: 'Sin asignar', lista: sinAsignar },
    { clave: 'mias' as const, etiqueta: 'Mías', lista: mias },
    { clave: 'entregadas' as const, etiqueta: 'Entregadas', lista: entregadas },
  ]
  const visibles = conColas ? (COLAS.find((c) => c.clave === cola)?.lista ?? []) : hilos

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

      <div
        className={
          conColas ? 'riel -mx-4 mb-3 flex gap-2 overflow-x-auto px-4' : 'hidden'
        }
      >
        {COLAS.map((c) => (
          <button
            key={c.clave}
            type="button"
            aria-pressed={cola === c.clave}
            onClick={() => setCola(c.clave)}
            className={`inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border px-4 text-base transition-colors ${
              cola === c.clave
                ? 'border-enlace bg-accent font-medium text-accent-foreground'
                : 'border-border bg-card text-foreground'
            }`}
          >
            {c.etiqueta}
            {c.lista.length > 0 && <span aria-hidden="true">· {c.lista.length}</span>}
            <span className="sr-only">, {c.lista.length}</span>
          </button>
        ))}
      </div>

      {/* Con hueco de sobra: la tarjeta de cartel proyecta su sombra 4 px
          abajo y a la derecha, y con `space-y-2` la de abajo se la comía. */}
      <ul className="space-y-3.5">
        {visibles.map((h) => (
          <FilaBandeja
            key={h.id}
            href={`/aliado/conversacion/${h.id}?volver=${encodeURIComponent(volverA)}`}
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
            hora={null}
            ultimo={`${h.mensajes_total} ${
              h.mensajes_total === 1 ? 'mensaje' : 'mensajes'
            }`}
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
