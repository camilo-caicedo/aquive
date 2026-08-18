import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { limitar } from '@/lib/backend/limite'

interface CuerpoRespuesta {
  codigo: string
  mensaje: string
  puedeLlevar?: boolean
}

// La respuesta pasa por aquí para limitar la tasa y usar la sesión de quien
// responde (la RPC resuelve el autor con auth.uid()). El aviso al
// solicitante ya no se manda aquí: lo encola `responder_solicitud` y lo
// despacha el cron (ver v2-l1).
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

  return NextResponse.json({ ok: true })
}
