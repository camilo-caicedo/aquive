'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, MessagesSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { contienePII } from '@/lib/validacion'
import { CAPACIDADES_PAGO, URGENCIAS, zonaLegible } from '@/lib/servicios'
import type { CapacidadPago, UrgenciaServicio } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { HojaAccion } from '@/components/hoja-accion'
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
  /** De aquí cuelga el hilo. Nulo mientras no haya respondido. */
  mi_respuesta_id: string | null
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
          <li key={s.id} className="rounded-2xl bg-card p-4 shadow-canto">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 text-lg font-bold">{s.oficio_nombre}</span>
              <span className="shrink-0 font-mono text-sm text-muted-foreground">
                {s.codigo}
              </span>
            </div>

            <p className="mt-0.5 text-base text-muted-foreground">
              {[zona, nombreMunicipio[s.municipio]].filter(Boolean).join(' · ')}
            </p>

            {/* Urgencia y capacidad de pago, como chips: son dos datos que
                se comparan entre solicitudes, y en una línea de texto con
                un reloj delante no se distinguían del resto. */}
            <ul className="mt-3 flex flex-wrap gap-2">
              <li className="rounded-full bg-accent px-3.5 py-1.5 text-sm text-accent-foreground">
                {etiquetaUrgencia(s.urgencia)}
              </li>
              <li className="rounded-full bg-muted px-3.5 py-1.5 text-sm text-foreground">
                {etiquetaPago(s.capacidad_pago)}
              </li>
            </ul>

            {s.nota && <p className="mt-3 text-base">{s.nota}</p>}

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="min-w-0 text-base text-muted-foreground">
                {s.num_respuestas === 0
                  ? 'Nadie ha respondido'
                  : s.num_respuestas === 1
                    ? '1 persona respondió'
                    : `${s.num_respuestas} personas respondieron`}
              </p>
            {s.ya_respondi ? (
              // Compacto: ya respondió, así que lo único que queda por saber
              // es cuánta competencia hay. El párrafo entero de antes ocupaba
              // tres líneas para decir eso.
              //
              // Y con el enlace al hilo, que es lo que le faltaba al chat de
              // servicios para tener puerta: el hilo se crea al abrirlo, y
              // hasta ahora la única pantalla que enlazaba a uno era la
              // bandeja, que solo enseña los que ya existen.
              <div className="flex shrink-0 items-center gap-3">
                <p className="flex items-center gap-1.5 text-base text-foreground">
                  <Check className="size-5 shrink-0" aria-hidden="true" />
                  Ya respondiste
                </p>
                {s.mi_respuesta_id && (
                  <Link
                    href={`/chat/servicio/${s.mi_respuesta_id}`}
                    aria-label={`Abrir el chat de la solicitud ${s.codigo}`}
                    className="border-enlace text-enlace hover:bg-accent flex size-12 shrink-0 items-center justify-center rounded-full border transition-colors"
                  >
                    <MessagesSquare className="size-5" aria-hidden="true" />
                  </Link>
                )}
              </div>
            ) : !puedeResponder ? null : (
              // El formulario se abría dentro de la tarjeta y empujaba el
              // resto de la lista hacia abajo: la solicitud que estabas
              // leyendo se iba bajo el dedo justo al ir a escribir. Ahora
              // va en una hoja inferior, encima de la lista, que se queda
              // quieta.
              <HojaAccion
                id={`responder-${s.id}`}
                titulo="Yo puedo hacerlo"
                disparador={(props) => (
                  <Button
                    {...props}
                    variant="outline"
                    className="shrink-0 border-enlace text-enlace"
                    onClick={() => {
                      setAbierta(s.id)
                      setError(null)
                    }}
                  >
                    Yo puedo hacerlo
                  </Button>
                )}
                pie={() => (
                  <Button
                    className="w-full"
                    onClick={() => responder(s.id)}
                    disabled={enviando || mensaje.trim().length < 10 || !!errorMensaje}
                  >
                    {enviando ? 'Enviando…' : 'Enviar respuesta'}
                  </Button>
                )}
              >
                <p className="text-base text-muted-foreground">
                  {s.oficio_nombre}
                </p>
                <Textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  maxLength={200}
                  rows={4}
                  aria-label={`Tu mensaje para la solicitud ${s.codigo}`}
                  placeholder="Puedo hacerlo mañana en la mañana. Cobro 20.000 por prenda."
                />
                <p className="text-sm text-muted-foreground">
                  {mensaje.length}/200. No escribas tu teléfono: tu ficha ya lo
                  muestra al lado de tu respuesta.
                </p>
                {errorMensaje && <p className="text-sm text-destructive">{errorMensaje}</p>}
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </HojaAccion>
            )}
            </div>

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
