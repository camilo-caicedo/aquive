import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/backend/servicio'
import { limitar } from '@/lib/backend/limite'
import { notificarRespuesta } from '@/lib/push'

interface CuerpoRespuesta {
  codigo: string
  mensaje: string
  puedeLlevar?: boolean
}

// La respuesta pasa por aquí y no por la RPC directa desde el navegador
// porque después de insertarla hay que avisar al solicitante, y las
// suscripciones push no son legibles para el cliente.
export async function POST(request: Request) {
  let body: CuerpoRespuesta
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const excedido = await limitar(request, { nombre: 'responder', max: 10, ventanaSegundos: 60 })
  if (excedido) return excedido

  const mensaje = body.mensaje?.trim() ?? ''
  if (mensaje.length < 5 || mensaje.length > 200) {
    return NextResponse.json({ error: 'El mensaje debe tener entre 5 y 200 caracteres' }, { status: 400 })
  }
  if (!body.codigo) {
    return NextResponse.json({ error: 'Falta el código de la solicitud' }, { status: 400 })
  }

  // Cliente con la sesión de la persona: la RPC resuelve el autor con auth.uid().
  const supabase = await createClient()
  const { data: solicitudId, error } = await supabase.rpc('responder_solicitud', {
    p_codigo: body.codigo,
    p_mensaje: mensaje,
    p_puede_llevar: body.puedeLlevar === true,
  })

  if (error || !solicitudId) {
    return NextResponse.json({ error: error?.message ?? 'No se pudo responder' }, { status: 400 })
  }

  // El aviso es best-effort: si falla, la respuesta ya quedó guardada y el
  // solicitante la ve al volver por su enlace.
  try {
    const servicio = createServiceClient()
    const { data: solicitud } = await servicio
      .from('solicitudes')
      .select('codigo')
      .eq('id', solicitudId)
      .maybeSingle()

    if (solicitud) {
      // No podemos enlazar a /solicitud/[token]: el servidor solo guarda el
      // hash del token. La notificación lleva a la lista local del navegador.
      const origen = new URL(request.url).origin
      await notificarRespuesta(solicitudId, solicitud.codigo, `${origen}/mis-solicitudes`)
    }
  } catch {
    // Silencioso a propósito: no se loggea nada del cuerpo (CLAUDE.md regla 6).
  }

  return NextResponse.json({ ok: true })
}
