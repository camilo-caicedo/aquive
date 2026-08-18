import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { limitar } from '@/lib/backend/limite'
import { notificarConversacion } from '@/lib/push-coordinacion'

interface CuerpoInvitacion {
  solicitudId: string
  /** Sin él, la fundación entrega de su propia bodega y no hay ofertador. */
  ofertadorId?: string
  mensaje: string
}

// Un aliado invita a coordinar a quien ofrece. Pasa por aquí y no por la
// RPC directa por lo mismo que /api/mensajes: hay que avisar después, y
// las suscripciones push no son legibles para el cliente.
//
// Este es el aviso que más falta hacía: a quien invitan no tiene por qué
// estar mirando la pantalla, y hasta ahora se enteraba solo si volvía.
export async function POST(request: Request) {
  let body: CuerpoInvitacion
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const excedido = await limitar(request, { nombre: 'invitacion', max: 20, ventanaSegundos: 60 })
  if (excedido) return excedido

  const mensaje = body.mensaje?.trim() ?? ''
  if (!body.solicitudId || mensaje.length < 10) {
    return NextResponse.json({ error: 'Falta el mensaje' }, { status: 400 })
  }

  // Dos caminos, una sola ruta: con ofertador es una invitación a
  // coordinar; sin él, la fundación entrega de su propia bodega. Las dos
  // RPC comprueban que quien llama sea miembro activo de la organización
  // que acompaña esa solicitud. Aquí no se decide nada.
  const supabase = await createClient()
  const directa = !body.ofertadorId

  const { data: conversacionId, error } = directa
    ? await supabase.rpc('abrir_entrega_directa', {
        p_solicitud_id: body.solicitudId,
        p_mensaje: mensaje,
      })
    : await supabase.rpc('invitar_a_conversacion', {
        p_solicitud_id: body.solicitudId,
        p_ofertador_id: body.ofertadorId!,
        p_mensaje: mensaje,
      })

  if (error || !conversacionId) {
    return NextResponse.json(
      { error: error?.message ?? 'No se pudo abrir la conversación' },
      { status: 400 }
    )
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    await notificarConversacion(
      conversacionId,
      (codigo) =>
        directa
          ? `La fundación va a coordinar la entrega de ${codigo}`
          : `Te invitaron a coordinar la entrega de ${codigo}`,
      new URL(request.url).origin,
      { perfilId: user?.id }
    )
  } catch {
    // Silencioso a propósito (regla 6).
  }

  return NextResponse.json({ ok: true })
}
