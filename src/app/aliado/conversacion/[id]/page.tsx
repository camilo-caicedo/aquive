import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarcoFlujo } from '@/components/marco-flujo'
import { Chat } from '@/components/chat'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ConversacionDetalle } from '@/lib/types'
import { RegistrarEntrega } from '../../registrar-entrega'

export const metadata = { title: 'Conversación' }

/**
 * Un hilo de coordinación, en su propia ruta.
 *
 * Antes se desplegaba dentro de la lista de `PanelHilos`: abrir uno empujaba
 * los demás hacia abajo, la fila que se estaba mirando se movía bajo el
 * dedo, y encima quedaban tres desplazamientos anidados —el hilo dentro de
 * la tarjeta dentro de la página—.
 *
 * `leer_conversacion` se sigue pidiendo bajo demanda y con los mismos
 * argumentos: lo único que cambia es quién la pide.
 */
export default async function ConversacionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase.rpc('leer_conversacion', {
    p_conversacion_id: id,
  })

  if (error || !data) {
    return (
      <MarcoFlujo titulo="Conversación" volver="/aliado?hilos=1">
        <Alert variant="destructive">
          <AlertDescription>
            No pudimos abrir esta conversación. Puede que se haya borrado con
            la solicitud, o que ya no formes parte de ella.
          </AlertDescription>
        </Alert>
      </MarcoFlujo>
    )
  }

  const hilo = data as unknown as ConversacionDetalle

  return (
    <MarcoFlujo titulo={hilo.codigo} volver="/aliado?hilos=1">
      <Chat
        conversacionId={hilo.id}
        estado={hilo.estado}
        miRol={hilo.mi_rol}
        acopio={hilo.acopio}
        mensajesIniciales={hilo.mensajes}
      />

      {/* Solo la fundación registra entregas: el sentido de que la entrega
          sea en el acopio es que hay un tercero mirando. La RPC lo vuelve a
          comprobar. */}
      {hilo.mi_rol === 'aliado' && (
        <RegistrarEntrega conversacionId={hilo.id} pendientes={hilo.pendientes} />
      )}
    </MarcoFlujo>
  )
}
