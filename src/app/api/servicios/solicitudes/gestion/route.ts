import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Renovar, marcar como resuelta o borrar una solicitud de servicio.
 *
 * El token va en el cuerpo, nunca en la URL (regla 6). Va por route
 * handler y no por RPC desde el navegador para que el token no quede en
 * el historial de peticiones del cliente de Supabase.
 */
export async function POST(request: Request) {
  let b: Record<string, unknown>
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  if (typeof b.token !== 'string' || b.token.length < 20) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }
  if (b.accion !== 'renovar' && b.accion !== 'resolver' && b.accion !== 'borrar') {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('gestionar_solicitud_servicio', {
    p_token: b.token,
    p_accion: b.accion,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
