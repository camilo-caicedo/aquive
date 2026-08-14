'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { validarMensaje } from '@/lib/validacion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type {
  AcopioResumen,
  ConversacionDelSolicitante,
  ConversacionDetalle,
  EstadoConversacion,
  MensajeChat,
  RolEnConversacion,
} from '@/lib/types'

const ETIQUETA_ROL: Record<RolEnConversacion, string> = {
  solicitante: 'Quien pidió',
  ofertador: 'Quien ofrece',
  aliado: 'La fundación',
  admin: 'Moderación de AquíVe',
}

// Treinta segundos, y solo con la pestaña a la vista.
//
// El plan pedía Supabase Realtime «no polling», y su razón era de cuota:
// sondear desde Vercel se come el millón de invocaciones del plan Hobby.
// Aquí el sondeo va del NAVEGADOR a Supabase, sin pasar por Vercel, así
// que no gasta ni una invocación. Y Realtime no se puede usar tal cual:
// `postgres_changes` respeta RLS, estas tablas están revocadas enteras, y
// uno de los tres participantes es anónimo con token, así que no hay
// `auth.uid()` con el que autorizarlo.
const CADA_MS = 30_000

export function Chat({
  conversacionId,
  token,
  estado,
  miRol,
  acopio,
  mensajesIniciales,
}: {
  conversacionId: string
  /** Presente solo para quien pidió ayuda, que no tiene cuenta. */
  token?: string
  estado: EstadoConversacion
  miRol: RolEnConversacion
  acopio: AcopioResumen | null
  mensajesIniciales: MensajeChat[]
}) {
  const [mensajes, setMensajes] = useState(mensajesIniciales)
  const [cuerpo, setCuerpo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const finRef = useRef<HTMLDivElement>(null)

  const cerrado = estado === 'cerrada' || estado === 'entregada'
  const esperando = estado === 'esperando_aliado' || estado === 'asignada'

  useEffect(() => {
    async function refrescar() {
      if (document.visibilityState !== 'visible') return
      const supabase = createClient()

      if (token) {
        const { data } = await supabase.rpc('mis_conversaciones_token', { p_token: token })
        const hilos = (data as unknown as ConversacionDelSolicitante[]) ?? []
        const mio = hilos.find((h) => h.id === conversacionId)
        if (mio) setMensajes(mio.mensajes)
        return
      }

      const { data } = await supabase.rpc('leer_conversacion', {
        p_conversacion_id: conversacionId,
      })
      const detalle = data as unknown as ConversacionDetalle | null
      if (detalle) setMensajes(detalle.mensajes)
    }

    const id = setInterval(refrescar, CADA_MS)
    return () => clearInterval(id)
  }, [conversacionId, token])

  async function enviar() {
    const problema = validarMensaje(cuerpo)
    if (problema) {
      setError(problema)
      return
    }

    setEnviando(true)
    setError(null)
    const supabase = createClient()

    const { error: rpcError } = token
      ? await supabase.rpc('enviar_mensaje_token', {
          p_token: token,
          p_conversacion_id: conversacionId,
          p_cuerpo: cuerpo.trim(),
        })
      : await supabase.rpc('enviar_mensaje', {
          p_conversacion_id: conversacionId,
          p_cuerpo: cuerpo.trim(),
        })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    // Se agrega en local en vez de volver a leer: el mensaje propio tiene
    // que aparecer al instante, y el sondeo ya trae lo demás.
    setMensajes((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        rol: miRol,
        nombre: null,
        cuerpo: cuerpo.trim(),
        oculto: false,
        creado_at: new Date().toISOString(),
      },
    ])
    setCuerpo('')
    setEnviando(false)
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="rounded-xl border border-border">
      {acopio && (
        <div className="border-b border-border bg-secondary p-3">
          <p className="text-base font-medium">{acopio.nombre}</p>
          {acopio.direccion && (
            <p className="text-sm text-muted-foreground">
              Acopio: {acopio.direccion}
              {acopio.horario && ` · ${acopio.horario}`}
            </p>
          )}
        </div>
      )}

      <ul className="max-h-96 space-y-3 overflow-y-auto p-3">
        {mensajes.length === 0 && (
          <li className="py-6 text-center text-base text-muted-foreground">
            Todavía no hay mensajes.
          </li>
        )}
        {mensajes.map((m) => (
          <li key={m.id} className={m.rol === miRol ? 'text-right' : undefined}>
            <p className="text-sm text-muted-foreground">
              {ETIQUETA_ROL[m.rol]}
              {m.nombre ? ` · ${m.nombre}` : ''}
            </p>
            <p
              className={`mt-1 inline-block max-w-[85%] rounded-xl px-3 py-2 text-left text-base ${
                m.rol === miRol
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {/* Moderar oculta, no borra, y el hueco se ve: si un mensaje
                  desapareciera sin dejar rastro, la conversación mentiría. */}
              {m.oculto ? (
                <span className="italic opacity-80">Mensaje retirado por moderación</span>
              ) : (
                m.cuerpo
              )}
            </p>
          </li>
        ))}
        <div ref={finRef} />
      </ul>

      <div className="border-t border-border p-3">
        {esperando ? (
          <p className="text-base text-muted-foreground">
            Nadie de la fundación se ha hecho cargo todavía. En cuanto
            alguien lo haga, se puede escribir aquí.
          </p>
        ) : cerrado ? (
          <p className="text-base text-muted-foreground">
            Esta conversación está cerrada.
          </p>
        ) : (
          <>
            <Textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Escribe aquí"
              aria-label="Mensaje"
            />
            {error && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              className="mt-2 w-full"
              disabled={enviando || cuerpo.trim().length === 0}
              onClick={enviar}
            >
              <Send className="size-5" aria-hidden="true" />
              {enviando ? 'Enviando…' : 'Enviar'}
            </Button>
          </>
        )}

        {/* Se dice en el chat, no en una página de ayuda: es donde alguien
            estaría a punto de usarlo como archivo. */}
        <p className="mt-2 text-sm text-muted-foreground">
          Esta conversación se borra cuando se borre la solicitud. No la uses
          para guardar nada que necesites después.
        </p>
      </div>
    </div>
  )
}
