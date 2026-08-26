import { randomUUID } from 'node:crypto'

import { and, asc, eq, isNull, lt } from 'drizzle-orm'
import sharp from 'sharp'

import type { BaseDeDatos } from '@/db/cliente'
import { imagenes } from '@/db/esquema'
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
  entrada: { objeto_tipo: 'muro' | 'producto'; tipo: string; bytes: number },
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

  // La limpia se guarda encima de la de cuarentena. La original con su EXIF
  // deja de existir en cuanto esto termina, aunque nadie la apruebe nunca.
  await almacen.subirAPublico(`${fila.ruta}.webp`, limpia.data, 'image/webp')
  await almacen.borrar('cuarentena', fila.ruta)

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

  return filas.map((f) => ({
    id: f.id,
    objeto_tipo: f.objeto_tipo as 'muro' | 'producto',
    objeto_id: f.objeto_id,
    url: almacen.urlPublica(`${f.ruta}.webp`),
    ancho: f.ancho,
    alto: f.alto,
    subida_at: String(f.subida_at),
  }))
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

  await db
    .update(imagenes)
    .set({
      estado: entrada.aprobar ? 'aprobada' : 'rechazada',
      motivo: entrada.aprobar ? null : (entrada.motivo ?? 'No cumple las normas.'),
      revisadaAt: new Date().toISOString(),
      revisadaPor: adminId,
    })
    .where(eq(imagenes.id, entrada.imagen_id))

  // Rechazada se borra del almacén, no solo se marca. Guardar un archivo que
  // se rechazó por tener a un menor identificable sería exactamente lo que la
  // decisión de rechazarlo dice que no se hace.
  if (!entrada.aprobar) await almacen.borrar('publico', `${fila.ruta}.webp`)

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

  return { borradas: viejas.length }
}
