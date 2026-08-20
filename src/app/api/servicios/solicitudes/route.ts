import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generarToken } from '@/lib/tokens'
import { validarNota } from '@/lib/validacion'
import { verificarTurnstile } from '@/lib/turnstile'
import { contienePII, MENSAJE_PII } from '@/lib/validacion'
import type { CapacidadPago, UrgenciaServicio } from '@/lib/types'

const URGENCIAS: readonly UrgenciaServicio[] = ['hoy', 'esta_semana', 'sin_prisa']
const PAGOS: readonly CapacidadPago[] = ['puedo_pagar', 'pago_poco', 'no_puedo_pagar']

/**
 * Publicar una solicitud de servicio.
 *
 * Igual que `/api/solicitudes`: Turnstile primero, el token se genera
 * aquí y `crear_solicitud_servicio` recibe el token en claro para
 * hashearlo dentro. La RPC no tiene `grant` a `anon` justamente para que
 * nadie pueda saltarse este handler y con él el anti-spam.
 *
 * De quien publica no se guarda nada. Ni aquí ni en la tabla.
 */
export async function POST(request: Request) {
  let b: Record<string, unknown>
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  if (
    typeof b.turnstileToken !== 'string' ||
    !(await verificarTurnstile(b.turnstileToken))
  ) {
    return NextResponse.json({ error: 'Verificación anti-spam fallida' }, { status: 400 })
  }

  if (typeof b.oficio_id !== 'string' || !b.oficio_id) {
    return NextResponse.json({ error: 'Elige qué necesitas' }, { status: 400 })
  }
  if (typeof b.municipio !== 'string' || !/^[0-9]{5}$/.test(b.municipio)) {
    return NextResponse.json({ error: 'Falta el municipio' }, { status: 400 })
  }
  if (!URGENCIAS.includes(b.urgencia as UrgenciaServicio)) {
    return NextResponse.json({ error: 'Di para cuándo lo necesitas' }, { status: 400 })
  }
  if (!PAGOS.includes(b.capacidad_pago as CapacidadPago)) {
    return NextResponse.json({ error: 'Falta la opción de pago' }, { status: 400 })
  }

  const zonaTexto = typeof b.zona_texto === 'string' ? b.zona_texto.trim() : ''
  if (zonaTexto && contienePII(zonaTexto)) {
    return NextResponse.json({ error: MENSAJE_PII }, { status: 400 })
  }

  const nota = typeof b.nota === 'string' ? b.nota.trim() : ''
  if (nota) {
    const errorNota = validarNota(nota)
    if (errorNota) {
      return NextResponse.json({ error: errorNota }, { status: 400 })
    }
  }

  const token = generarToken()
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('crear_solicitud_servicio', {
    p_oficio_id: b.oficio_id,
    p_municipio: b.municipio,
    p_zona_id: typeof b.zona_id === 'string' && b.zona_id ? b.zona_id : null,
    p_zona_texto: zonaTexto || null,
    p_urgencia: b.urgencia as UrgenciaServicio,
    p_capacidad_pago: b.capacidad_pago as CapacidadPago,
    p_nota: nota || null,
    p_token: token,
  })

  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { error: error?.message ?? 'No se pudo publicar la solicitud' },
      { status: 400 }
    )
  }

  return NextResponse.json({ codigo: data[0].codigo, token })
}
