import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/backend/servicio'
import { limitar } from '@/lib/backend/limite'

interface CuerpoGestion {
  token: string
  accion: 'renovar' | 'cerrar'
  cumplida?: boolean
}

// Renovar y cerrar comparten ruta porque comparten lo único que importa:
// el token va en el cuerpo, nunca en la URL (CLAUDE.md regla 6).
export async function POST(request: Request) {
  let body: CuerpoGestion
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  if (!body.token) {
    return NextResponse.json({ error: 'Falta el enlace de la solicitud' }, { status: 400 })
  }

  const excedido = await limitar(request, { nombre: 'gestion', max: 20, ventanaSegundos: 60 })
  if (excedido) return excedido

  const supabase = createServiceClient()

  if (body.accion === 'renovar') {
    const { data, error } = await supabase.rpc('renovar_solicitud', { p_token: body.token })
    if (error) {
      return NextResponse.json({ error: 'No se pudo renovar' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, expira_at: data })
  }

  if (body.accion === 'cerrar') {
    const { error } = await supabase.rpc('cerrar_solicitud', {
      p_token: body.token,
      p_cumplida: body.cumplida ?? true,
    })
    if (error) {
      return NextResponse.json({ error: 'No se pudo cerrar' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}
