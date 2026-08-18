import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/backend/servicio'
import { limitar } from '@/lib/backend/limite'
import { generarToken } from '@/lib/tokens'
import { validarBarrio, validarNota, validarSugerencia } from '@/lib/validacion'
import { verificarTurnstile } from '@/lib/turnstile'
import { CATEGORIAS } from '@/lib/catalogo'
import type { Categoria, ItemSolicitudInput, Json } from '@/lib/types'

// La lista de categorías válidas se deriva de CATEGORIAS: antes estaba
// escrita otra vez aquí, y agregar una nueva obligaba a tocar los dos sitios.
const VALIDAS: readonly Categoria[] = CATEGORIAS.map((c) => c.valor)

const MAX_SUGERENCIAS = 3

interface CuerpoSolicitud {
  municipio: string
  barrio: string
  categoria: Categoria
  nota: string | null
  items: unknown[]
  puedeRecoger?: boolean
  turnstileToken: string
}

function esItemCatalogoValido(item: unknown): item is { item_id: string; cantidad: number } {
  if (typeof item !== 'object' || item === null) return false
  const candidato = item as Record<string, unknown>
  return (
    typeof candidato.item_id === 'string' &&
    typeof candidato.cantidad === 'number' &&
    candidato.cantidad > 0 &&
    candidato.cantidad <= 9999
  )
}

function esSugerenciaValida(item: unknown): item is { sugerencia: string; cantidad: number } {
  if (typeof item !== 'object' || item === null) return false
  const candidato = item as Record<string, unknown>
  return (
    typeof candidato.sugerencia === 'string' &&
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

  const excedido = await limitar(request, { nombre: 'crear', max: 5, ventanaSegundos: 60 })
  if (excedido) return excedido

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

  if (!VALIDAS.includes(body.categoria)) {
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

  // Se normaliza aparte (en vez de solo validar) porque la sugerencia hay
  // que recortarla antes de mandarla a la RPC: el cliente ya recorta, pero
  // el servidor no puede confiar en eso.
  const itemsValidados: ItemSolicitudInput[] = []
  let numSugerencias = 0
  for (const item of body.items) {
    if (esItemCatalogoValido(item)) {
      itemsValidados.push(item)
      continue
    }
    if (!esSugerenciaValida(item)) {
      return NextResponse.json({ error: 'Ítems inválidos' }, { status: 400 })
    }
    const nombre = item.sugerencia.trim()
    const errorSugerencia = validarSugerencia(nombre)
    if (errorSugerencia) {
      return NextResponse.json({ error: errorSugerencia }, { status: 400 })
    }
    numSugerencias++
    if (numSugerencias > MAX_SUGERENCIAS) {
      return NextResponse.json({ error: 'Máximo 3 ítems sugeridos por solicitud' }, { status: 400 })
    }
    itemsValidados.push({ sugerencia: nombre, cantidad: item.cantidad })
  }

  const token = generarToken()
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('crear_solicitud', {
    p_municipio: body.municipio,
    p_barrio: body.barrio.trim(),
    p_categoria: body.categoria,
    p_nota: nota,
    p_items: itemsValidados as unknown as Json,
    p_token: token,
    p_puede_recoger: body.puedeRecoger === true,
  })

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'No se pudo crear la solicitud' }, { status: 500 })
  }

  // El aviso a quienes ofrecen en ese municipio ya no se manda aquí: la RPC
  // `crear_solicitud` lo encola y el cron lo despacha (ver v2-l1). La
  // respuesta vuelve sin esperar al fan-out.
  return NextResponse.json({ codigo: data[0].codigo, token })
}
