'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { contienePII } from '@/lib/validacion'
import { CAPACIDADES_PAGO, URGENCIAS, zonaLegible } from '@/lib/servicios'
import type { CapacidadPago, UrgenciaServicio } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

export interface SolicitudDeServicio {
  id: string
  codigo: string
  oficio_id: string
  oficio_nombre: string
  municipio: string
  zona_nombre: string | null
  zona_texto: string | null
  urgencia: UrgenciaServicio
  capacidad_pago: CapacidadPago
  nota: string | null
  creada_at: string
  num_respuestas: number
  ya_respondi: boolean
}

const etiquetaUrgencia = (v: UrgenciaServicio) =>
  URGENCIAS.find((u) => u.valor === v)?.etiqueta ?? v
const etiquetaPago = (v: CapacidadPago) =>
  CAPACIDADES_PAGO.find((c) => c.valor === v)?.etiqueta ?? v

export function ListaSolicitudesServicio({
  solicitudes,
  nombreMunicipio,
  puedeResponder,
}: {
  solicitudes: SolicitudDeServicio[]
  nombreMunicipio: Record<string, string>
  puedeResponder: boolean
}) {
  const router = useRouter()
  const [abierta, setAbierta] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errorMensaje =
    mensaje.trim() && contienePII(mensaje)
      ? 'No pongas tu teléfono aquí: ya sale en tu ficha, y esa persona lo va a ver.'
      : null

  async function responder(id: string) {
    setEnviando(true)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('responder_servicio', {
      p_solicitud_id: id,
      p_mensaje: mensaje.trim(),
    })
    setEnviando(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setAbierta(null)
    setMensaje('')
    router.refresh()
  }

  return (
    <ul className="mt-6 space-y-3">
      {solicitudes.map((s) => {
        const zona = zonaLegible(s.zona_nombre, s.zona_texto)
        return (
          <li key={s.id} className="rounded-lg border border-border p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-lg font-bold">{s.oficio_nombre}</span>
              <span className="font-mono text-sm text-muted-foreground">{s.codigo}</span>
            </div>

            <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
              <span>{[zona, nombreMunicipio[s.municipio]].filter(Boolean).join(' · ')}</span>
            </p>

            <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
              <span>
                {etiquetaUrgencia(s.urgencia)} · {etiquetaPago(s.capacidad_pago)}
              </span>
            </p>

            {s.nota && <p className="mt-2 text-base">{s.nota}</p>}

            <p className="mt-2 text-sm text-muted-foreground">
              {s.num_respuestas === 0
                ? 'Nadie ha respondido'
                : s.num_respuestas === 1
                  ? '1 persona respondió'
                  : `${s.num_respuestas} personas respondieron`}
            </p>

            {s.ya_respondi ? (
              <p className="mt-3 text-base text-ok">
                Ya respondiste. Esa persona tiene tu teléfono y decide si te
                escribe.
              </p>
            ) : !puedeResponder ? null : abierta === s.id ? (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  maxLength={200}
                  rows={3}
                  aria-label={`Tu mensaje para la solicitud ${s.codigo}`}
                  placeholder="Puedo hacerlo mañana en la mañana. Cobro 20.000 por prenda."
                />
                <p className="text-sm text-muted-foreground">
                  {mensaje.length}/200. No escribas tu teléfono: tu ficha ya lo
                  muestra al lado de tu respuesta.
                </p>
                {errorMensaje && <p className="text-sm text-destructive">{errorMensaje}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => responder(s.id)}
                    disabled={enviando || mensaje.trim().length < 10 || !!errorMensaje}
                  >
                    {enviando ? 'Enviando…' : 'Enviar respuesta'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAbierta(null)
                      setMensaje('')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setAbierta(s.id)
                  setError(null)
                }}
              >
                Yo puedo hacerlo
              </Button>
            )}

            {error && abierta === s.id && (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </li>
        )
      })}
    </ul>
  )
}
