import { randomUUID } from 'node:crypto'

import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import sharp from 'sharp'

import type { BaseDeDatos } from '@/db/cliente'
import { administradores, imagenes } from '@/db/esquema'
import * as almacen from './almacen'

// El recorrido de una imagen, de la regla de producto 8.
//
//   1. El servidor firma un PUT contra `cuarentena/<id>`, que NO es público.
//   2. El cliente sube directo. El archivo nunca atraviesa una función.
//   3. Aquí se reencodifica con sharp. Eso DESCARTA TODOS LOS METADATOS —el
//      EXIF de una foto de teléfono lleva las coordenadas GPS de dónde se
//      tomó—, redimensiona y normaliza el formato.
//   4. Queda en la cola de moderación del admin.
//   5. Aprobada, se escribe en `publico/` y se borra la de cuarentena.
//      Rechazada, se borra y quien la subió recibe el motivo.
//   6. Borrar la fila borra el objeto.
//
// El paso 3 no es negociable y no lo puede sustituir la moderación humana:
// quien modera ve la imagen, no sus metadatos. Sin reencodificar, publicar la
// foto de una nevera publica dónde vive quien la dona.

export class ImagenRechazada extends Error {}

const LADO_MAXIMO = 1600

export async function firmarSubida(
  db: BaseDeDatos,
  entrada: { objeto_tipo: 'muro' | 'producto' | 'proveedor'; tipo: string; bytes: number },
) {
  if (!almacen.TIPOS_ACEPTADOS.includes(entrada.tipo as never)) {
    throw new ImagenRechazada('Ese tipo de archivo no es una imagen que aceptemos.')
  }
  if (entrada.bytes > almacen.TOPE_BYTES) {
    throw new ImagenRechazada('La imagen pesa más de 2 MB. Prueba con una más pequeña.')
  }

  const ruta = `${entrada.objeto_tipo}/${randomUUID()}`
  const firmada = await almacen.firmarSubida(ruta)

  const [fila] = await db
    .insert(imagenes)
    .values({ objetoTipo: entrada.objeto_tipo, ruta, bytes: entrada.bytes })
    .returning({ id: imagenes.id })

  return { imagen_id: fila.id, url: firmada.url, ruta }
}

/**
 * Limpia la imagen recién subida: quita metadatos, redimensiona y la deja en
 * WebP. Se llama en cuanto el cliente confirma que terminó de subir.
 */
export async function procesar(db: BaseDeDatos, imagenId: string) {
  const [fila] = await db
    .select({ ruta: imagenes.ruta, estado: imagenes.estado })
    .from(imagenes)
    .where(eq(imagenes.id, imagenId))
    .limit(1)

  if (!fila) throw new ImagenRechazada('Esa imagen no existe.')

  const original = await almacen.descargarDeCuarentena(fila.ruta)

  // `sharp` reescribe el archivo desde los píxeles, así que el EXIF no
  // sobrevive: no hay que borrarlo, es que no se copia. `rotate()` sin
  // argumentos aplica la orientación del EXIF ANTES de descartarlo, o las
  // fotos verticales de teléfono saldrían tumbadas.
  const limpia = await sharp(original)
    .rotate()
    .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })

  await db
    .update(imagenes)
    .set({
      ancho: limpia.info.width,
      alto: limpia.info.height,
      bytes: limpia.data.length,
    })
    .where(eq(imagenes.id, imagenId))

  // La limpia se guarda ENCIMA de la original, en cuarentena. Dos cosas a
  // la vez: la original con su EXIF deja de existir en cuanto esto termina
  // —aunque nadie la apruebe nunca— y la limpia NO se publica todavía.
  //
  // ⚠ Antes esto subía a `publico/` aquí mismo, en el paso 3. El bucket
  // público lo es de verdad, así que el archivo era alcanzable por URL
  // desde antes de que nadie lo mirara: la regla de producto 8 dice que
  // eso pasa en el paso 5, «aprobada», y por eso el paso 1 firma contra un
  // bucket que no es público. Las vistas filtraban `estado='aprobada'` y
  // dentro de la aplicación no se veía — pero el archivo estaba publicado.
  await almacen.subirACuarentena(fila.ruta, limpia.data, 'image/webp')

  return { ok: true as const }
}

/** Enlazar una imagen ya subida con la publicación que la lleva. */
export async function enlazar(
  db: BaseDeDatos,
  imagenId: string,
  objetoId: string,
) {
  await db.update(imagenes).set({ objetoId }).where(eq(imagenes.id, imagenId))
}

/** La cola del admin: lo que nadie ha mirado todavía, lo más viejo primero. */
export async function cola(db: BaseDeDatos, limite = 30) {
  const filas = await db
    .select({
      id: imagenes.id,
      objeto_tipo: imagenes.objetoTipo,
      objeto_id: imagenes.objetoId,
      ruta: imagenes.ruta,
      ancho: imagenes.ancho,
      alto: imagenes.alto,
      subida_at: imagenes.subidaAt,
    })
    .from(imagenes)
    .where(eq(imagenes.estado, 'en_cola'))
    .orderBy(asc(imagenes.subidaAt))
    .limit(limite)

  // Una URL firmada de CUARENTENA, no la pública: lo que se está moderando
  // todavía no está publicado, y esta lista era el único sitio que
  // imprimía la URL pública de algo sin aprobar.
  return await Promise.all(
    filas.map(async (f) => ({
      id: f.id,
      objeto_tipo: f.objeto_tipo as 'muro' | 'producto' | 'proveedor',
      objeto_id: f.objeto_id,
      url: await almacen.urlFirmadaDeCuarentena(f.ruta),
      ancho: f.ancho,
      alto: f.alto,
      subida_at: String(f.subida_at),
    })),
  )
}

export async function moderar(
  db: BaseDeDatos,
  entrada: { imagen_id: string; aprobar: boolean; motivo?: string },
  adminId: string,
) {
  const [fila] = await db
    .select({ ruta: imagenes.ruta })
    .from(imagenes)
    .where(eq(imagenes.id, entrada.imagen_id))
    .limit(1)

  if (!fila) throw new ImagenRechazada('Esa imagen no existe.')

  // ⚠ Aquí y en ninguna otra parte se publica una imagen. Es el paso 5 de
  // la regla de producto 8: aprobada, se copia a `publico/`; rechazada, se
  // borra. Antes esta función solo cambiaba `estado` y el archivo llevaba
  // publicado desde el paso 3.
  if (entrada.aprobar) {
    const limpia = await almacen.descargarDeCuarentena(fila.ruta)
    await almacen.subirAPublico(`${fila.ruta}.webp`, limpia, 'image/webp')
  }

  // El estado se escribe DESPUÉS de mover el archivo. Al revés, un fallo al
  // copiar dejaría una imagen marcada como aprobada que no está en ningún
  // sitio, y las vistas la buscarían para siempre.
  await db
    .update(imagenes)
    .set({
      estado: entrada.aprobar ? 'aprobada' : 'rechazada',
      motivo: entrada.aprobar ? null : (entrada.motivo ?? 'No cumple las normas.'),
      revisadaAt: new Date().toISOString(),
      revisadaPor: adminId,
    })
    .where(eq(imagenes.id, entrada.imagen_id))

  // Cuarentena se vacía en los dos casos: aprobada, su copia ya está en
  // público; rechazada, no queda nada. Guardar un archivo que se rechazó por
  // tener a un menor identificable sería exactamente lo que la decisión de
  // rechazarlo dice que no se hace.
  await almacen.borrar('cuarentena', fila.ruta)

  return { ok: true as const }
}

/**
 * Las huérfanas: subidas, nunca enlazadas a una publicación.
 *
 * Alguien empezó a escribir, subió una foto y se fue. Sin esto, cada abandono
 * deja un archivo pagando almacenamiento para siempre.
 */
export async function barrerHuerfanas(db: BaseDeDatos) {
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const viejas = await db
    .select({ id: imagenes.id, ruta: imagenes.ruta })
    .from(imagenes)
    .where(and(isNull(imagenes.objetoId), lt(imagenes.subidaAt, hace24h)))

  for (const v of viejas) {
    await almacen.borrar('cuarentena', v.ruta)
    await almacen.borrar('publico', `${v.ruta}.webp`)
    await db.delete(imagenes).where(eq(imagenes.id, v.id))
  }

  // Segunda pasada: las que sí tienen `objeto_id`, pero apuntando a algo que
  // ya no existe.
  //
  // `imagenes` no tiene llave foránea hacia su objeto —no puede, porque el
  // objeto vive en tres tablas distintas—, así que borrar un producto, una
  // publicación o una ficha por una vía que no limpie el almacén deja esto
  // detrás. Hoy todas esas vías limpian; esta pasada es la red por si mañana
  // aparece una que no.
  const colgando = await db
    .select({ id: imagenes.id, ruta: imagenes.ruta })
    .from(imagenes)
    .where(
      sql`${imagenes.objetoId} is not null and not exists (
        select 1 from productos p where p.id = ${imagenes.objetoId}
        union all select 1 from publicaciones_muro m where m.id = ${imagenes.objetoId}
        union all select 1 from proveedores v where v.id = ${imagenes.objetoId}
      )`,
    )

  for (const c of colgando) {
    await almacen.borrar('cuarentena', c.ruta)
    await almacen.borrar('publico', `${c.ruta}.webp`)
    await db.delete(imagenes).where(eq(imagenes.id, c.id))
  }

  return { borradas: viejas.length + colgando.length }
}

/**
 * ¿Es admin?
 *
 * Se comprueba aquí y no en la pantalla. Una pantalla de admin que solo
 * esconde el botón deja el procedimiento abierto a cualquiera con sesión, y
 * moderar imágenes es decidir qué se publica.
 */
export async function esAdmin(db: BaseDeDatos, usuarioId: string | null) {
  if (!usuarioId) return false
  const [fila] = await db
    .select({ id: administradores.userId })
    .from(administradores)
    .where(eq(administradores.userId, usuarioId))
    .limit(1)
  return Boolean(fila)
}

/**
 * Borrar las imágenes de unos objetos, del almacén y de la tabla.
 *
 * ⚠ Esto existe porque `ON DELETE CASCADE` no borra un archivo de un bucket
 * (regla de producto 3), y porque `imagenes` **no tiene llave foránea hacia
 * su objeto**: ni siquiera la fila se iba sola. Borrar una ficha dejaba la
 * foto de la cara de esa persona en una URL pública, con su fila apuntando a
 * algo que ya no existe — y el barredor de huérfanas no la alcanzaba, porque
 * solo mira las que tienen `objeto_id` en nulo.
 *
 * Se llama ANTES de borrar la fila dueña. Al revés no habría forma de saber
 * qué imágenes eran suyas.
 */
export async function borrarImagenesDe(
  db: BaseDeDatos,
  objetos: { tipo: 'muro' | 'producto' | 'proveedor'; id: string }[],
) {
  if (objetos.length === 0) return { borradas: 0 }

  const filas = await db
    .select({ id: imagenes.id, ruta: imagenes.ruta })
    .from(imagenes)
    .where(
      or(
        ...objetos.map((o) =>
          and(eq(imagenes.objetoTipo, o.tipo), eq(imagenes.objetoId, o.id)),
        ),
      ),
    )

  for (const f of filas) {
    // Los dos buckets: en cuarentena vive lo que espera revisión, en público
    // lo aprobado. Una imagen está en uno o en otro, y borrar del que no
    // toca no cuesta nada.
    await almacen.borrar('cuarentena', f.ruta)
    await almacen.borrar('publico', `${f.ruta}.webp`)
    await db.delete(imagenes).where(eq(imagenes.id, f.id))
  }

  return { borradas: filas.length }
}
