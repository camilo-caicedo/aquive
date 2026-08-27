import { notFound } from 'next/navigation'

import { Origen } from '@/contrato/chat'
import { servidor } from '@/orpc/local'
import { createClient } from '@/lib/supabase/server'
import { MarcoFlujo } from '@/components/marco-flujo'
import { PuertaCerrada } from '@/components/puerta-cerrada'
import { Chat } from '@/components/chat'

export const metadata = { title: 'Chat' }

/**
 * El hilo. Pantalla 12, y ahora para los cuatro módulos.
 *
 * Una sola ruta y un solo componente para los dos lados: quién eres lo
 * decide el servidor por de qué eres dueño, no por la ruta por la que
 * entras. Antes vivía en `/servicios/chat/[respuesta]`, cuando servicios era
 * lo único que tenía chat.
 *
 * La sesión se mira aquí y no en el dominio porque sin ella hay que decir
 * algo, no devolver un 404: quien toca «escribir» en un producto y aterriza
 * en «no encontrado» cree que el producto se borró.
 */
export default async function ChatPage({
  params,
}: {
  params: Promise<{ tipo: string; id: string }>
}) {
  const crudo = await params
  const origen = Origen.safeParse(crudo)
  if (!origen.success) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const destino = `/chat/${origen.data.tipo}/${origen.data.id}`

  if (!user) {
    return (
      <MarcoFlujo titulo="Escribir" volver="/inicio">
        <PuertaCerrada
          titulo="Para escribir hace falta una cuenta"
          porque="El chat es de dos personas y se borra con lo que lo abrió. Sin cuenta no hay forma de saber que quien vuelve mañana es quien escribió hoy."
          seConserva="Al entrar vuelves justo a esta conversación."
          destino={destino}
          alternativa="Si prefieres no crear cuenta, quien publicó dejó su WhatsApp y su teléfono en su ficha."
        />
      </MarcoFlujo>
    )
  }

  const hilo = await servidor.chat.leer({ origen: origen.data })
  if (!hilo) notFound()

  return (
    <MarcoFlujo titulo={hilo.con} volver="/mensajes">
      {hilo.asunto && (
        <p className="font-heading mb-4 text-xs font-bold tracking-[0.085em] text-muted-foreground uppercase">
          {hilo.asunto}
        </p>
      )}
      <Chat origen={origen.data} hiloInicial={hilo} />
    </MarcoFlujo>
  )
}
