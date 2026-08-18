import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/backend/servicio'
import { limitar } from '@/lib/backend/limite'

/**
 * Borrado permanente de la cuenta (Ley 1581 de 2012, art. 8: supresión).
 *
 * Se borra el usuario de Auth, no solo la fila de `perfiles`. Auth guarda
 * el correo de Google —fuera de nuestras tablas, pero guardado—, así que
 * dejarlo vivo no sería supresión de verdad. El resto cae por cascada:
 * perfiles → servidores → respuestas.
 */
export async function DELETE(request: Request) {
  const excedido = await limitar(request, { nombre: 'perfil-borrar', max: 5, ventanaSegundos: 60 })
  if (excedido) return excedido

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No hay sesión' }, { status: 401 })
  }

  const servicio = createServiceClient()
  const { error } = await servicio.auth.admin.deleteUser(user.id)

  if (error) {
    return NextResponse.json({ error: 'No se pudo borrar la cuenta' }, { status: 500 })
  }

  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
