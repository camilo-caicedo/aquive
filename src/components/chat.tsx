'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { validarMensaje } from '@/lib/validacion'
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

// Cinco segundos, y solo con la pestaña a la vista. Además se refresca al
// volver a la pestaña, que es el momento en que de verdad se nota el
// retraso: uno vuelve del WhatsApp y quiere ver si contestaron.
//
// El plan pedía Supabase Realtime «no polling», y su razón era de cuota:
// sondear desde Vercel se come el millón de invocaciones del plan Hobby.
// Aquí el sondeo va del NAVEGADOR a Supabase, sin pasar por Vercel, así
// que no gasta ni una invocación.
//
// Y `postgres_changes` no sirve tal cual: respeta RLS, estas tablas están
// revocadas enteras, y uno de los tres participantes es anónimo con token,
// así que no hay `auth.uid()` con el que autorizarlo. La vía que sí
// funcionaría es un broadcast SIN contenido —«pasó algo en este hilo»— que
// dispare esta misma consulta; queda pendiente si cinco segundos se
// quedan cortos.
const CADA_MS = 5_000

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
    // Al volver a la pestaña no se espera al siguiente turno del reloj:
    // ese es justo el instante en que el retraso se siente.
    document.addEventListener('visibilitychange', refrescar)
    window.addEventListener('focus', refrescar)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refrescar)
      window.removeEventListener('focus', refrescar)
    }
  }, [conversacionId, token])

  async function enviar() {
    const problema = validarMensaje(cuerpo)
    if (problema) {
      setError(problema)
      return
    }

    setEnviando(true)
    setError(null)

    // Por la ruta y no por la RPC directa: al otro lado hay que avisar a
    // los otros dos por push, y las suscripciones no son legibles para el
    // navegador. La autorización no se mueve — la sigue resolviendo la
    // misma RPC, solo que llamada desde el servidor.
    const respuesta = await fetch('/api/mensajes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversacionId, cuerpo: cuerpo.trim(), token }),
    })

    if (!respuesta.ok) {
      const { error: mensajeError } = await respuesta.json().catch(() => ({ error: null }))
      setError(mensajeError ?? 'No pudimos enviar el mensaje.')
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
    // Sin caja ni desplazamiento propio. Antes había tres desplazamientos
    // anidados —el hilo dentro de la tarjeta dentro de la página— y en un
    // teléfono el dedo no sabía cuál iba a mover. Ahora el hilo se desplaza
    // con la página y el redactor va fijo abajo.
    <div>
      {acopio && (
        <div className="sticky top-14 z-30 -mx-4 flex items-center gap-2 border-b border-border bg-secondary px-4 py-2 text-secondary-foreground sm:top-16">
          <Package className="size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 truncate text-base">
            {acopio.nombre}
            {acopio.direccion ? ` · ${acopio.direccion}` : ''}
            {acopio.horario ? ` · ${acopio.horario}` : ''}
          </p>
        </div>
      )}

      {/* Al principio del hilo y no bajo el redactor, donde competía con
          el botón de enviar. Se lee una vez, al entrar, que es cuando
          sirve. */}
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Esta conversación se borra junto con la solicitud, a las 72 horas. No la
        uses para guardar nada que necesites después.
      </p>

      <ul className="mt-3 space-y-1">
        {mensajes.length === 0 && (
          <li className="py-6 text-center text-base text-muted-foreground">
            Todavía no hay mensajes.
          </li>
        )}
        {mensajes.map((m, i) => {
          // La etiqueta del papel sale cuando cambia de emisor, no en cada
          // burbuja: repetida en quince mensajes seguidos es ruido y hace
          // que el hilo se lea como un formulario.
          const anterior = mensajes[i - 1]
          const mismoEmisor = anterior && anterior.rol === m.rol && anterior.nombre === m.nombre
          const mio = m.rol === miRol
          return (
          <li key={m.id} className={mio ? 'text-right' : undefined}>
            {!mismoEmisor && (
              <p className={`mt-3 text-sm text-muted-foreground`}>
                {ETIQUETA_ROL[m.rol]}
                {m.nombre ? ` · ${m.nombre}` : ''}
              </p>
            )}
            <p
              className={`mt-1 inline-block max-w-[85%] px-3 py-2 text-left text-base ${
                m.oculto
                  ? 'rounded-xl border border-dashed border-border text-muted-foreground'
                  : mio
                    ? 'rounded-xl rounded-br-sm bg-primary text-primary-foreground'
                    : // Papel elevado y no `bg-muted`: el apagado es apenas
                      // más oscuro que el papel del fondo, así que sobre el
                      // hilo las burbujas recibidas casi no se recortaban.
                      // La sombra hace el resto — el borde sobraría con
                      // quince mensajes seguidos.
                      'rounded-xl rounded-bl-sm bg-card text-foreground shadow-canto'
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
          )
        })}
        <div ref={finRef} />
      </ul>

      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
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
            {/* `items-end` y los dos del mismo alto: en reposo quedan a ras,
                y cuando el campo crece con el texto el botón se queda
                pegado a la última línea, que es donde lo busca el pulgar.
                Con alturas distintas —el campo en 64 y el botón en 52— el
                círculo flotaba a media altura del recuadro. */}
            <div className="flex items-end gap-2">
              <Textarea
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                maxLength={1000}
                rows={1}
                placeholder="Escribe aquí"
                aria-label="Mensaje"
                // `resize-none` porque `field-sizing-content` ya lo hace
                // crecer solo: el agarre de la esquina era un adorno que
                // además dejaba una marca diagonal sobre el borde.
                className="min-h-14 flex-1 resize-none py-4"
              />
              {/* Icono al lado y no un botón de ancho completo debajo: el
                  redactor va fijo, y una fila de más le come dos líneas de
                  hilo en cada pantalla. */}
              <button
                type="button"
                disabled={enviando || cuerpo.trim().length === 0}
                onClick={enviar}
                aria-label={enviando ? 'Enviando' : 'Enviar mensaje'}
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              >
                <Send className="size-5" aria-hidden="true" />
              </button>
            </div>
            {error && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </>
        )}

      </div>
    </div>
  )
}
