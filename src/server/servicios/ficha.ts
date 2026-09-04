import { eq } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { productos, proveedores, publicacionesMuro } from '@/db/esquema'
import { borrarImagenesDe } from '@/server/imagenes/recorrido'

export class FichaRechazada extends Error {}

/**
 * Qué imágenes son de esta persona, en toda la aplicación.
 *
 * Su foto de ficha, las de los productos que cuelgan de esa ficha, y las de
 * lo que publicó en el muro. Es la lista que hay que borrar del almacén
 * ANTES de que la cascada se lleve las filas dueñas, porque después ya no
 * habría de dónde deducirla.
 */
export async function imagenesDe(db: BaseDeDatos, perfilId: string) {
  const objetos: { tipo: 'muro' | 'producto' | 'proveedor'; id: string }[] = []

  const [ficha] = await db
    .select({ id: proveedores.id })
    .from(proveedores)
    .where(eq(proveedores.perfilId, perfilId))
    .limit(1)

  if (ficha) {
    objetos.push({ tipo: 'proveedor', id: ficha.id })
    const suyos = await db
      .select({ id: productos.id })
      .from(productos)
      .where(eq(productos.proveedorId, ficha.id))
    for (const p of suyos) objetos.push({ tipo: 'producto', id: p.id })
  }

  const publicaciones = await db
    .select({ id: publicacionesMuro.id })
    .from(publicacionesMuro)
    .where(eq(publicacionesMuro.perfilId, perfilId))
  for (const p of publicaciones) objetos.push({ tipo: 'muro', id: p.id })

  return objetos
}

/**
 * Borrar la ficha propia, con todo lo que cuelga de ella.
 *
 * ⚠ Esto era la RPC `borrar_proveedor`, un `delete from proveedores` y nada
 * más. Una función de Postgres **no puede borrar un objeto del almacén**, así
 * que la foto de la cara de esa persona se quedaba en una URL pública
 * después de que ella pidiera borrarla — y la fila de `imagenes` quedaba
 * apuntando a algo inexistente, fuera del alcance del barredor de huérfanas.
 *
 * Sube al dominio por eso, no por gusto: es exactamente lo que la regla de
 * producto 3 dice que es código y no SQL.
 *
 * Las reseñas que recibió se van con la ficha, por cascada. Se le dice antes
 * en la pantalla: no es un efecto secundario escondido.
 */
export async function borrar(
  db: BaseDeDatos,
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) throw new FichaRechazada('Esto no es tuyo.')

  const [ficha] = await db
    .select({ id: proveedores.id })
    .from(proveedores)
    .where(eq(proveedores.perfilId, llave.usuarioId))
    .limit(1)

  if (!ficha) throw new FichaRechazada('No tienes ficha publicada.')

  // Su foto y las de sus productos. Las del muro NO: cuelgan del perfil, no
  // de la ficha, y borrar la ficha no borra lo que esa persona regaló.
  const suyos = await db
    .select({ id: productos.id })
    .from(productos)
    .where(eq(productos.proveedorId, ficha.id))

  await borrarImagenesDe(db, [
    { tipo: 'proveedor', id: ficha.id },
    ...suyos.map((p) => ({ tipo: 'producto' as const, id: p.id })),
  ])

  // Y ahora sí la fila. La cascada se lleva productos, oficios, referencias,
  // reseñas y los hilos de chat que colgaban de ella.
  await db.delete(proveedores).where(eq(proveedores.id, ficha.id))

  return { ok: true }
}

/**
 * Las imágenes de una persona que se va entera.
 *
 * La llama el borrado de cuenta, que es un Route Handler porque necesita la
 * API de administración de Auth. Aquí solo se limpia el almacén; la cascada
 * de `auth.users` se lleva todo lo demás.
 */
export async function limpiarImagenesDeCuenta(db: BaseDeDatos, perfilId: string) {
  return await borrarImagenesDe(db, await imagenesDe(db, perfilId))
}
