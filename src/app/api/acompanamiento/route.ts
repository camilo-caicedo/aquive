import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notificarAcompanamiento } from '@/lib/push-coordinacion'

interface CuerpoAcompanamiento {
  token: string
}

// Solo avisa. La activación en sí NO pasa por aquí, y eso es a propósito:
// `activar_acompanamiento` lleva nombre, documento y teléfono, y esos
// datos van del navegador a Supabase sin escala. Meterlos en una ruta de
// Vercel sería multiplicar por dos los sitios donde pueden quedar en un
// registro.
//
// El token va en el cuerpo, nunca en la URL (regla 6), y lo que autoriza
// el aviso es tenerlo: solo quien acaba de activar el acompañamiento de
// esa solicitud puede dispararlo.
export async function POST(request: Request) {
  let body: CuerpoAcompanamiento
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  if (!body.token) {
    return NextResponse.json({ error: 'Falta el token' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()
    const { data: solicitud } = await supabase
      .from('solicitudes')
      .select('id, codigo, flujo')
      .eq('token_hash', createHash('sha256').update(body.token).digest('hex'))
      .maybeSingle()

    // Sin acompañamiento no hay nada que anunciar. Se responde `ok` igual:
    // el aviso es un extra y quien llamó ya terminó lo suyo.
    if (solicitud?.flujo === 'acompanado') {
      await notificarAcompanamiento(
        solicitud.id,
        solicitud.codigo,
        `${new URL(request.url).origin}/responder/${solicitud.codigo}`
      )
    }
  } catch {
    // Silencioso a propósito (regla 6).
  }

  return NextResponse.json({ ok: true })
}
