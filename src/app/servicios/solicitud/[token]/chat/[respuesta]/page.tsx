import { notFound } from 'next/navigation'

import { servidor } from '@/orpc/local'
import { MarcoFlujo } from '@/components/marco-flujo'
import { ChatServicio } from '@/components/chat-servicio'

export const metadata = { title: 'Chat' }

/**
 * El hilo, visto por quien pidió el servicio.
 *
 * El token va en el PATH y nunca en query string (regla de producto 9): una
 * query string acaba en el registro de acceso del proveedor de alojamiento y
 * en el historial del navegador, y ese token es la única llave que tiene
 * quien pide — no tiene cuenta.
 */
export default async function ChatDeQuienPidePage({
  params,
}: {
  params: Promise<{ token: string; respuesta: string }>
}) {
  const { token, respuesta } = await params

  const hilo = await servidor.chat.leer({ respuesta_id: respuesta, token })
  if (!hilo) notFound()

  return (
    <MarcoFlujo titulo={hilo.con} volver={`/servicios/solicitud/${token}`}>
      {hilo.oficio && (
        <p className="font-heading mb-4 text-xs font-bold tracking-[0.085em] text-muted-foreground uppercase">
          {hilo.oficio}
        </p>
      )}
      <ChatServicio respuestaId={respuesta} token={token} hiloInicial={hilo} />
    </MarcoFlujo>
  )
}
