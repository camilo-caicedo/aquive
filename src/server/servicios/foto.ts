import { and, eq, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { imagenes, proveedores } from '@/db/esquema'
import * as almacen from '@/server/imagenes/almacen'

export class FotoRechazada extends Error {}

/**
 * La foto de la ficha, con su autorización.
 *
 * ⚠ La foto de una persona es dato personal publicado, así que va con
 * casilla propia, finalidad declarada y versión guardada con su fecha
 * (mínimo legal 2, Ley 1581 artículo 9). Y con casilla APARTE de la de
 * publicar nombre y teléfono, por lo mismo que el punto del mapa la tiene
 * (ADR 0004): una cara no es lo mismo que un número.
 *
 * ⚠ Esto vive en el dominio y no en una función de Postgres porque tiene
 * que borrar OBJETOS DEL ALMACÉN, y `on delete cascade` no borra un
 * archivo de un bucket (regla de producto 3). Quitar la foto sin borrar el
 * archivo dejaría la cara de alguien en una URL pública después de que esa
 * persona dijera que no.
 *
 * Una ficha lleva una sola foto: al poner otra, la anterior se borra.
 */
export async function guardar(
  db: BaseDeDatos,
  entrada: { imagen_id: string | null; autorizacion_version: string | null },
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) throw new FotoRechazada('Para esto necesitas entrar con tu cuenta.')

  const [ficha] = await db
    .select({ id: proveedores.id })
    .from(proveedores)
    .where(eq(proveedores.perfilId, llave.usuarioId))
    .limit(1)
  if (!ficha) throw new FotoRechazada('Todavía no tienes ficha publicada.')

  const quitar = entrada.imagen_id === null

  if (!quitar && !entrada.autorizacion_version?.trim()) {
    throw new FotoRechazada('Falta marcar que autorizas publicar tu foto.')
  }

  // Lo que ya había, sea porque se quita o porque se reemplaza. Se lee
  // ANTES de tocar nada: después de la actualización la vista ya no la
  // devuelve y quedaría el archivo suelto.
  const viejas = await db
    .select({ id: imagenes.id, ruta: imagenes.ruta })
    .from(imagenes)
    .where(and(eq(imagenes.objetoTipo, 'proveedor'), eq(imagenes.objetoId, ficha.id)))

  await db
    .update(proveedores)
    .set(
      quitar
        ? { aceptoFoto: false, fotoVersion: null, fotoAt: null }
        : {
            aceptoFoto: true,
            fotoVersion: entrada.autorizacion_version!.trim(),
            fotoAt: sql`now()`,
          },
    )
    .where(eq(proveedores.id, ficha.id))

  if (!quitar) {
    await db
      .update(imagenes)
      .set({ objetoId: ficha.id })
      .where(eq(imagenes.id, entrada.imagen_id!))
  }

  // Borrar es DELETE, y borrar la fila borra el objeto: los dos buckets,
  // porque una imagen todavía en cola vive en cuarentena y una aprobada en
  // público.
  for (const v of viejas) {
    await almacen.borrar('cuarentena', v.ruta)
    await almacen.borrar('publico', `${v.ruta}.webp`)
    await db.delete(imagenes).where(eq(imagenes.id, v.id))
  }

  return { ok: true }
}
