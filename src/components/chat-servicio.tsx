'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'

import { rpc } from '@/orpc/cliente'
import type { Hilo, Mensaje } from '@/contrato/chat'

/**
 * El hilo de un pedido de servicio. Pantalla 12.
 *
 * Sirve a los dos lados con el mismo componente: el prestador entra con su
 * sesión y quien pide con el token de su solicitud. La diferencia la resuelve
 * el servidor —decide quién eres por lo que traes, no por lo que dices—, así
 * que aquí solo cambia de quién es cada burbuja.
 *
 * Sin sondeo automático a propósito. Un `setInterval` contra el servidor cada
 * pocos segundos, en un teléfono viejo con datos contados, gasta batería y
 * plan para casi siempre no traer nada. Se refresca al enviar y con el botón
 * de actualizar; el aviso de mensaje nuevo llega por push, que es para lo que
 * está.
 */
export function ChatServicio({
  respuestaId,
  token,
  hiloInicial,
}: {
  respuestaId: string
  token?: string
  hiloInicial: Hilo
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(hiloInicial.mensajes)
  const [cuerpo, setCuerpo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [rechazo, setRechazo] = useState<string | null>(null)
  const finRef = useRef<HTMLDivElement>(null)

  // El hilo abre por el final, que es donde está la conversación.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' })
  }, [mensajes.length])

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    const texto = cuerpo.trim()
    if (!texto || enviando) return

    setEnviando(true)
    setRechazo(null)
    try {
      const { mensaje } = await rpc.chat.escribir({
        respuesta_id: respuestaId,
        token,
        cuerpo: texto,
      })
      setMensajes((previos) => [...previos, mensaje])
      setCuerpo('')
    } catch (error) {
      // El motivo viene tipado del contrato: se dice EXACTAMENTE por qué no
      // se envió. Un filtro que rechaza sin explicar enseña a pelear con la
      // pantalla, no a coordinar por aquí.
      const motivo =
        error && typeof error === 'object' && 'data' in error
          ? ((error.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setRechazo(motivo ?? 'No se pudo enviar. Revisa la conexión.')
    } finally {
      setEnviando(false)
    }
  }

  const cerrado = hiloInicial.cerrado

  return (
    <div className="flex min-h-[60vh] flex-col">
      <ol className="flex-1 space-y-3" aria-live="polite">
        {mensajes.length === 0 && (
          <li className="text-base text-muted-foreground">
            Todavía no hay mensajes. Escribe para acordar el trabajo.
          </li>
        )}
        {mensajes.map((m) => {
          const mio = token ? m.autor === 'quien_pide' : m.autor === 'prestador'
          return (
            <li key={m.id} className={mio ? 'flex justify-end' : 'flex justify-start'}>
              {/* La burbuja propia en arena y no en lima: un hilo de veinte
                  mensajes en lima es lima dominante, que es justo lo que el
                  manual prohíbe. El lima es la acción de enviar. */}
              <p
                className={`shadow-canto max-w-[80%] rounded-2xl px-4 py-2.5 text-base ${
                  mio ? 'bg-secondary' : 'bg-card'
                }`}
              >
                {m.cuerpo}
              </p>
            </li>
          )
        })}
        <div ref={finRef} />
      </ol>

      {rechazo && (
        <p
          role="alert"
          className="bg-accent text-accent-foreground mt-3 rounded-xl px-4 py-3 text-base"
        >
          {rechazo}
        </p>
      )}

      {cerrado ? (
        <p className="mt-4 text-base text-muted-foreground">
          Este hilo ya se cerró. No se pueden enviar más mensajes.
        </p>
      ) : (
        <form onSubmit={enviar} className="mt-4 flex items-end gap-2">
          <label htmlFor="cuerpo" className="sr-only">
            Escribe un mensaje
          </label>
          <textarea
            id="cuerpo"
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Escribe un mensaje"
            className="bg-card border border-input focus-visible:ring-ring min-h-14 flex-1 resize-none rounded-2xl px-4 py-3 text-base focus-visible:ring-2 focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={enviando || cuerpo.trim().length === 0}
            className="bg-primary text-primary-foreground shadow-boton active:shadow-boton-hundido flex size-14 shrink-0 items-center justify-center rounded-full transition-all active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40"
            aria-label="Enviar mensaje"
          >
            <Send className="size-6" aria-hidden="true" />
          </button>
        </form>
      )}

      <p className="mt-3 text-sm text-muted-foreground">
        Este chat existe para acordar el trabajo y se borra con el pedido. No se
        guardan conversaciones y no se pueden compartir teléfonos ni correos por
        aquí.
      </p>
    </div>
  )
}
