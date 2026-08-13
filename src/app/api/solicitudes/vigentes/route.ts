import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hashToken } from '@/lib/tokens'

/**
 * Dice cuáles de los enlaces guardados en el teléfono siguen vivos.
 *
 * `localStorage` es el único lugar donde vive el token, así que el
 * navegador no tiene forma de enterarse de que una solicitud ya se venció
 * o se cerró. Sin esto la lista acumula tarjetas fantasma que llevan a
 * una página que ya no existe.
 *
 * Los tokens van en el cuerpo, nunca en la URL (CLAUDE.md regla 6).
 */
export async function POST(request: Request) {
  let body: { tokens?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const tokens = Array.isArray(body.tokens)
    ? body.tokens.filter((t): t is string => typeof t === 'string').slice(0, 50)
    : []

  if (tokens.length === 0) return NextResponse.json({ vigentes: [] })

  const porHash = new Map(tokens.map((t) => [hashToken(t), t]))

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('solicitudes')
    .select('token_hash')
    .in('token_hash', [...porHash.keys()])

  if (error) {
    // Ante la duda no se borra nada: perder un enlace es irreversible.
    return NextResponse.json({ vigentes: tokens })
  }

  const vigentes = (data ?? [])
    .map((fila) => porHash.get(fila.token_hash))
    .filter((t): t is string => !!t)

  return NextResponse.json({ vigentes })
}
