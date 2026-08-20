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
 * Devuelve además la categoría y el barrio de las que siguen vivas: la
 * tarjeta de «Lo mío» solo tenía el código, que no le dice nada a quien
 * publicó tres cosas distintas y no se acuerda de cuál es cuál. Son datos
 * de la solicitud, no de nadie: municipio y barrio es lo más fino que
 * existe en la base (regla 1).
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

  if (tokens.length === 0) return NextResponse.json({ vigentes: [], datos: {} })

  const porHash = new Map(tokens.map((t) => [hashToken(t), t]))

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('solicitudes')
    .select('token_hash, codigo, categoria, barrio, municipio')
    .in('token_hash', [...porHash.keys()])

  if (error) {
    // Ante la duda no se borra nada: perder un enlace es irreversible.
    return NextResponse.json({ vigentes: tokens, datos: {} })
  }

  const vigentes: string[] = []
  const datos: Record<string, { categoria: string; barrio: string }> = {}
  for (const fila of data ?? []) {
    const token = porHash.get(fila.token_hash)
    if (!token) continue
    vigentes.push(token)
    datos[token] = { categoria: fila.categoria, barrio: fila.barrio }
  }

  return NextResponse.json({ vigentes, datos })
}
