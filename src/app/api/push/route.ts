import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

interface CuerpoPush {
  token: string
  endpoint: string
  p256dh: string
  auth: string
}

// El token viaja en el cuerpo, nunca en la query string (CLAUDE.md regla 6).
export async function POST(request: Request) {
  let body: CuerpoPush
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  if (!body.token || !body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.rpc('guardar_push', {
    p_token: body.token,
    p_endpoint: body.endpoint,
    p_p256dh: body.p256dh,
    p_auth: body.auth,
  })

  if (error) {
    return NextResponse.json({ error: 'No se pudo activar el aviso' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
