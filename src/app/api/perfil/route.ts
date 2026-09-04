import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { db } from '@/db/cliente'
import { limpiarImagenesDeCuenta } from '@/server/servicios/ficha'

/**
 * Borrado permanente de la cuenta (Ley 1581 de 2012, art. 8: supresión).
 *
 * Se borra el usuario de Auth, no solo la fila de `perfiles`. Auth guarda
 * el correo de Google —fuera de nuestras tablas, pero guardado—, así que
 * dejarlo vivo no sería supresión de verdad. El resto cae por cascada:
 * perfiles → servidores → respuestas.
 *
 * ⚠ Las imágenes se borran ANTES, y a mano. La cascada arrastra las filas
 * dueñas —ficha, productos, publicaciones del muro— pero `ON DELETE CASCADE`
 * no borra un archivo de un bucket, y `imagenes` ni siquiera tiene llave
 * foránea hacia su objeto: sin esto, la foto de la cara de quien pidió que
 * lo borráramos todo se quedaba en una URL pública, con su fila apuntando a
 * algo que ya no existe y fuera del alcance del barredor de huérfanas.
 */
export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No hay sesión' }, { status: 401 })
  }

  // Primero el almacén: después del `deleteUser` ya no habría de dónde
  // deducir qué imágenes eran suyas.
  await limpiarImagenesDeCuenta(db, user.id)

  const servicio = createServiceClient()
  const { error } = await servicio.auth.admin.deleteUser(user.id)

  if (error) {
    return NextResponse.json({ error: 'No se pudo borrar la cuenta' }, { status: 500 })
  }

  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
