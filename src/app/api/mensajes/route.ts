import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notificarConversacion } from '@/lib/push-coordinacion'

interface CuerpoMensaje {
  conversacionId: string
  cuerpo: string
  /** Presente solo para quien pidió ayuda, que no tiene cuenta. */
  token?: string
}

// El mensaje pasa por aquí y no por la RPC directa desde el navegador
// porque después de guardarlo hay que avisar a los otros dos, y las
// suscripciones push no son legibles para el cliente. Mismo motivo que
// /api/respuestas.
//
// La autorización no se mueve de sitio: la sigue resolviendo la RPC, con
// `rol_en_conversacion` o con el token. Esta ruta no decide quién puede
// escribir dónde.
export async function POST(request: Request) {
  let body: CuerpoMensaje
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const cuerpo = body.cuerpo?.trim() ?? ''
  if (!body.conversacionId || cuerpo.length < 1) {
    return NextResponse.json({ error: 'Falta el mensaje' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = body.token
    ? await supabase.rpc('enviar_mensaje_token', {
        p_token: body.token,
        p_conversacion_id: body.conversacionId,
        p_cuerpo: cuerpo,
      })
    : await supabase.rpc('enviar_mensaje', {
        p_conversacion_id: body.conversacionId,
        p_cuerpo: cuerpo,
      })

  if (error) {
    // El mensaje de la RPC se devuelve tal cual: los del filtro de
    // contacto (regla M) están escritos para leerse en pantalla.
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const origen = new URL(request.url).origin

    await notificarConversacion(
      body.conversacionId,
      (codigo) => `Hay un mensaje nuevo en la coordinación de ${codigo}`,
      origen,
      body.token ? { solicitante: true } : { perfilId: user?.id }
    )
  } catch {
    // Silencioso a propósito: no se loggea nada del cuerpo (regla 6).
  }

  return NextResponse.json({ ok: true })
}
