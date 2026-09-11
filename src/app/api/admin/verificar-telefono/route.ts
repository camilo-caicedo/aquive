import { createClient } from '@/lib/supabase/server'
import { db } from '@/db/cliente'
import { proveedores } from '@/db/esquema'
import { eq } from 'drizzle-orm'
import { avisar } from '@/server/avisos/push'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ motivo: 'Cuerpo inválido' }, { status: 400 })
  }

  const proveedorId = typeof body.proveedor_id === 'string' ? body.proveedor_id : null
  const verificado = typeof body.verificado === 'boolean' ? body.verificado : null

  if (!proveedorId || verificado === null) {
    return Response.json({ motivo: 'Argumentos inválidos' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase.rpc('verificar_telefono_proveedor', {
    p_proveedor_id: proveedorId,
    p_verificado: verificado,
  })

  if (error) {
    return Response.json({ motivo: error.message }, { status: 400 })
  }

  if (verificado) {
    const [fila] = await db
      .select({ perfilId: proveedores.perfilId })
      .from(proveedores)
      .where(eq(proveedores.id, proveedorId))
      .limit(1)

    if (fila?.perfilId) {
      await avisar(db, fila.perfilId, {
        cuerpo: 'Verificamos tu teléfono. Tu ficha ya se ve en el directorio.',
        url: '/perfil/verificaciones',
        tag: `telefono-verificado-${proveedorId}`,
      })
    }
  }

  return Response.json({ ok: true })
}
