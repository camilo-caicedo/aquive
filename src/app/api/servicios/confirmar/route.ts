import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verificarTurnstile } from '@/lib/turnstile'
import { contienePII, MENSAJE_PII } from '@/lib/validacion'

/**
 * Confirmar un servicio y dejar la calificación.
 *
 * Va por route handler con Turnstile delante, y por eso
 * `confirmar_y_resenar` no tiene `grant` a `anon`. El código es
 * imposible de adivinar de una —32^8— pero sin anti-spam nada impide
 * intentarlo un millón de veces desde un script.
 *
 * El código llega en el CUERPO. Nunca en la URL, ni siquiera en el path
 * (regla 6): quien lo tiene lo recibió en un papel o por WhatsApp.
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

  if (typeof b.codigo !== 'string' || b.codigo.trim().length < 6) {
    return NextResponse.json({ error: 'Escribe el código completo' }, { status: 400 })
  }

  const nota = (v: unknown) => (typeof v === 'number' && v >= 1 && v <= 3 ? v : null)
  const cumplimiento = nota(b.cumplimiento)
  const trato = nota(b.trato)
  const puntualidad = nota(b.puntualidad)
  if (cumplimiento === null || trato === null || puntualidad === null) {
    return NextResponse.json({ error: 'Falta calificar los tres puntos' }, { status: 400 })
  }

  const comentario = typeof b.comentario === 'string' ? b.comentario.trim() : ''
  if (comentario.length > 140) {
    return NextResponse.json(
      { error: 'El comentario no puede pasar de 140 caracteres' },
      { status: 400 }
    )
  }
  if (comentario && contienePII(comentario)) {
    return NextResponse.json({ error: MENSAJE_PII }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('confirmar_y_resenar', {
    p_codigo: b.codigo.trim(),
    p_cumplimiento: cumplimiento,
    p_trato: trato,
    p_puntualidad: puntualidad,
    p_comentario: comentario || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
