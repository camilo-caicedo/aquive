import { createClient } from '@/lib/supabase/server'
import { db } from '@/db/cliente'
import { sql } from 'drizzle-orm'
import { avisar } from '@/server/avisos/push'
import type { EstadoReferencia } from '@/lib/types'

const ESTADOS_VALIDOS: EstadoReferencia[] = ['pendiente', 'confirmada', 'no_contesta', 'rechazada']

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ motivo: 'Cuerpo inválido' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : null
  const estado =
    typeof body.estado === 'string' && ESTADOS_VALIDOS.includes(body.estado as EstadoReferencia)
      ? (body.estado as EstadoReferencia)
      : null

  if (!id || !estado) {
    return Response.json({ motivo: 'Argumentos inválidos' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase.rpc('marcar_referencia', {
    p_id: id,
    p_estado: estado,
  })

  if (error) {
    return Response.json({ motivo: error.message }, { status: 400 })
  }

  if (estado === 'confirmada') {
    // Obtenemos el perfil_id del proveedor asociado a esta referencia mediante SQL
    const resultado = await db.execute<{ perfil_id: string }>(
      sql`select p.perfil_id from public.referencias r join public.proveedores p on p.id = r.proveedor_id where r.id = ${id} limit 1`,
    )
    const perfilId = resultado.rows[0]?.perfil_id

    if (perfilId) {
      await avisar(db, perfilId, {
        cuerpo: 'Una persona de la fundación confirmó una de tus referencias.',
        url: '/perfil/verificaciones',
        tag: `referencia-confirmada-${id}`,
      })
    }
  }

  return Response.json({ ok: true })
}
