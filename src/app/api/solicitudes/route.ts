import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generarToken } from '@/lib/tokens'
import { validarBarrio, validarNota, validarSugerencia } from '@/lib/validacion'
import { verificarTurnstile } from '@/lib/turnstile'
import { notificarOfertadores } from '@/lib/push-ofertadores'
import { CATEGORIAS } from '@/lib/catalogo'
import type { Categoria, ItemSolicitudInput, Json } from '@/lib/types'

// Ambas se derivan de CATEGORIAS: antes la lista de categorías válidas
// estaba escrita otra vez aquí, y agregar una nueva obligaba a acordarse
// de tocar los dos sitios.
const VALIDAS: readonly Categoria[] = CATEGORIAS.map((c) => c.valor)
const ETIQUETA = new Map(CATEGORIAS.map((c) => [c.valor, c.etiqueta]))

const MAX_SUGERENCIAS = 3

interface CuerpoSolicitud {
  municipio: string
  barrio: string
  categoria: Categoria
  nota: string | null
  items: unknown[]
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
  })

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'No se pudo crear la solicitud' }, { status: 500 })
  }

  // Avisar a quienes ofrecen en ese municipio. Best-effort: si falla, la
  // solicitud ya quedó publicada y se ve en el tablero igual.
  try {
    const servicio = createServiceClient()
    const { data: municipio } = await servicio
      .from('municipios')
      .select('nombre')
      .eq('codigo_dane', body.municipio)
      .maybeSingle()

    if (municipio) {
      const etiqueta = ETIQUETA.get(body.categoria) ?? 'insumos'
      // Los ítems del catálogo, para que quien tenga inventario reciba el
      // aviso solo si la solicitud pide algo suyo. Los sugeridos no
      // cuentan: todavía no son un ítem con el que se pueda cruzar.
      const idsPedidos = itemsValidados
        .filter((i): i is { item_id: string; cantidad: number } => 'item_id' in i)
        .map((i) => i.item_id)
      await notificarOfertadores(body.municipio, municipio.nombre, etiqueta, idsPedidos)
    }
  } catch {
    // Silencioso: no se loggea nada del cuerpo (CLAUDE.md regla 6).
  }

  return NextResponse.json({ codigo: data[0].codigo, token })
}
