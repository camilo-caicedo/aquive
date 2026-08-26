import { notFound } from 'next/navigation'

import { servidor } from '@/orpc/local'
import { MarcoFlujo } from '@/components/marco-flujo'
import { ChatServicio } from '@/components/chat-servicio'

export const metadata = { title: 'Chat' }

/**
 * El hilo, visto por el prestador.
 *
 * Aquí no hay token: el prestador tiene cuenta y el servidor lo reconoce por
 * su sesión. Es la misma pantalla y el mismo componente que del otro lado —
 * quién eres lo decide el servidor por lo que traes, no por la ruta.
 */
export default async function ChatDelPrestadorPage({
  params,
}: {
  params: Promise<{ respuesta: string }>
}) {
  const { respuesta } = await params

  const hilo = await servidor.chat.leer({ respuesta_id: respuesta })
  if (!hilo) notFound()

  return (
    <MarcoFlujo titulo={hilo.con} volver="/servicios/soy-proveedor">
      {hilo.oficio && (
        <p className="font-heading mb-4 text-xs font-bold tracking-[0.085em] text-muted-foreground uppercase">
          {hilo.oficio}
        </p>
      )}
      <ChatServicio respuestaId={respuesta} hiloInicial={hilo} />
    </MarcoFlujo>
  )
}
