import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generarToken } from '@/lib/tokens'
import { validarBarrio, validarNota } from '@/lib/validacion'
import { verificarTurnstile } from '@/lib/turnstile'
import type { Categoria, Json } from '@/lib/types'

const CATEGORIAS: readonly Categoria[] = [
  'alimentacion',
  'aseo',
  'salud',
  'abrigo',
  'cocina',
  'otros',
  'servicios',
  'mascotas',
]

interface ItemBody {
  item_id: string
  cantidad: number
}

interface CuerpoSolicitud {
  municipio: string
  barrio: string
  categoria: Categoria
  nota: string | null
  items: ItemBody[]
  turnstileToken: string
}

function esItemValido(item: unknown): item is ItemBody {
  if (typeof item !== 'object' || item === null) return false
  const candidato = item as Record<string, unknown>
  return (
    typeof candidato.item_id === 'string' &&
    typeof candidato.cantidad === 'number' &&
    candidato.cantidad > 0 &&
    candidato.cantidad <= 9999
  )
}

export async function POST(request: Request) {
  let body: CuerpoSolicitud
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  if (!body.turnstileToken || !(await verificarTurnstile(body.turnstileToken))) {
    return NextResponse.json({ error: 'Verificación anti-spam fallida' }, { status: 400 })
  }

  if (typeof body.municipio !== 'string' || !body.municipio) {
    return NextResponse.json({ error: 'Falta el municipio' }, { status: 400 })
  }

  const errorBarrio = validarBarrio(body.barrio ?? '')
  if (errorBarrio) {
    return NextResponse.json({ error: errorBarrio }, { status: 400 })
  }

  if (!CATEGORIAS.includes(body.categoria)) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
  }

  const nota = body.nota?.trim() || null
  if (nota) {
    const errorNota = validarNota(nota)
    if (errorNota) {
      return NextResponse.json({ error: errorNota }, { status: 400 })
    }
  }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 12) {
    return NextResponse.json({ error: 'Debe incluir entre 1 y 12 ítems' }, { status: 400 })
  }
  if (!body.items.every(esItemValido)) {
    return NextResponse.json({ error: 'Ítems inválidos' }, { status: 400 })
  }

  const token = generarToken()
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('crear_solicitud', {
    p_municipio: body.municipio,
    p_barrio: body.barrio.trim(),
    p_categoria: body.categoria,
    p_nota: nota,
    p_items: body.items as unknown as Json,
    p_token: token,
  })

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'No se pudo crear la solicitud' }, { status: 500 })
  }

  return NextResponse.json({ codigo: data[0].codigo, token })
}
