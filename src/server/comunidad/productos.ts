import { and, desc, eq } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { imagenes, productos, proveedores } from '@/db/esquema'
import { contienePII } from '@/lib/validacion'
import { borrar } from '@/server/imagenes/almacen'
import { enlazar } from '@/server/imagenes/recorrido'
import type { MiProducto } from '@/contrato/comunidad'

export class ProductoRechazado extends Error {}

/**
 * «Hecho en el barrio»: lo que hacen y venden las personas del directorio.
 *
 * ⚠ Un producto NO es un oficio, y por eso vive en su propia tabla. Un
 * oficio es un trabajo que se contrata —«arreglos de ropa, desde $15.000
 * por prenda»—; un producto es una cosa que ya existe y se vende —«tamales,
 * $3.500 la unidad»—. Se buscan distinto y se acuerdan distinto.
 *
 * Lo que sí comparten es el dueño: un producto cuelga de la ficha de
 * prestador de quien lo vende. Eso no es comodidad de modelo, son tres
 * cosas a la vez:
 *
 *   · Quien vende aparece con su nombre, y ese nombre ya tiene su
 *     autorización firmada con fecha (mínimo legal 2). Sin ficha habría que
 *     volver a pedirla aquí.
 *   · Borrar la ficha borra los productos, que es lo que espera quien se
 *     va del sitio.
 *   · Quien compra puede mirar a quién le está comprando: sus sellos, sus
 *     servicios confirmados, cómo contactarlo.
 *
 * El precio es información y nada más: AquíVe no vende y no cobra comisión
 * (regla de producto 1). Por eso es modo + «desde» + unidad de lista, nunca
 * texto libre — por ahí se cuela un segundo teléfono.
 */

/** La ficha de quien llama, que es lo único que autoriza a publicar aquí. */
async function fichaDe(db: BaseDeDatos, usuarioId: string | null) {
  if (!usuarioId) return null
  const [ficha] = await db
    .select({ id: proveedores.id, suspendido: proveedores.suspendido })
    .from(proveedores)
    .where(eq(proveedores.perfilId, usuarioId))
    .limit(1)
  return ficha ?? null
}

export async function mios(
  db: BaseDeDatos,
  usuarioId: string | null,
): Promise<MiProducto[]> {
  const ficha = await fichaDe(db, usuarioId)
  if (!ficha) return []

  // De la tabla y no de la vista pública, a propósito: aquí hay que ver
  // también lo que se guardó como no disponible y lo que tiene la foto sin
  // aprobar. La vista existe para esconderle eso a quien busca, no a quien
  // lo escribió.
  const filas = await db
    .select()
    .from(productos)
    .where(eq(productos.proveedorId, ficha.id))
    .orderBy(desc(productos.creadoAt))

  // `numeric` llega como texto desde Postgres, que es lo correcto —no cabe
  // en un `number` sin perder precisión— pero un precio de barrio sí cabe.
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    detalle: f.detalle,
    modo: f.modo as MiProducto['modo'],
    precio_desde: f.precioDesde === null ? null : Number(f.precioDesde),
    unidad: f.unidad as MiProducto['unidad'],
    disponible: f.disponible,
    creado_at: f.creadoAt,
  }))
}

export async function publicar(
  db: BaseDeDatos,
  entrada: {
    nombre: string
    detalle?: string
    modo: 'gratis' | 'aporte' | 'solidario' | 'normal'
    precio_desde?: number
    unidad?: 'unidad' | 'libra' | 'kilo' | 'docena' | 'plato' | 'trabajo'
    imagen_id?: string
  },
  llave: { usuarioId: string | null },
): Promise<{ id: string }> {
  const ficha = await fichaDe(db, llave.usuarioId)
  if (!ficha) {
    throw new ProductoRechazado(
      'Para vender algo aquí necesitas tener tu ficha publicada: es la que lleva tu nombre y por donde te escriben.',
    )
  }
  if (ficha.suspendido) {
    throw new ProductoRechazado('Tu ficha está suspendida, así que no aparece nada tuyo.')
  }

  // Los dos campos libres, con su filtro. Es la regla de producto 4 y es la
  // misma que el muro: un nombre de producto con un teléfono dentro
  // convierte esta lista en un directorio de teléfonos.
  for (const texto of [entrada.nombre, entrada.detalle ?? '']) {
    if (texto && contienePII(texto)) {
      throw new ProductoRechazado(
        'No escribas teléfonos, correos ni cédulas. Quien lo quiera te escribe por los datos de tu ficha.',
      )
    }
  }

  // Un precio sin unidad no dice nada —«desde $3.500» ¿de qué?— y una
  // unidad sin precio tampoco. O van los dos, o no va ninguno.
  const hayPrecio = entrada.precio_desde !== undefined && entrada.precio_desde !== null
  if (hayPrecio !== Boolean(entrada.unidad)) {
    throw new ProductoRechazado('El precio va con su unidad: «desde $3.500 la unidad».')
  }
  if (entrada.modo === 'gratis' && hayPrecio) {
    throw new ProductoRechazado('Si lo regalas, no lleva precio.')
  }

  const [fila] = await db
    .insert(productos)
    .values({
      proveedorId: ficha.id,
      nombre: entrada.nombre,
      detalle: entrada.detalle ?? null,
      modo: entrada.modo,
      precioDesde: hayPrecio ? String(entrada.precio_desde) : null,
      unidad: entrada.unidad ?? null,
    })
    .returning({ id: productos.id })

  if (entrada.imagen_id) await enlazar(db, entrada.imagen_id, fila.id)
  return { id: fila.id }
}

/**
 * Quitarlo de la lista sin borrarlo. Sirve para lo que se acabó y vuelve —
 * los tamales del domingo—, que si no habría que escribirlo otra vez cada
 * semana.
 */
export async function disponibilidad(
  db: BaseDeDatos,
  id: string,
  disponible: boolean,
  llave: { usuarioId: string | null },
) {
  const ficha = await fichaDe(db, llave.usuarioId)
  if (!ficha) throw new ProductoRechazado('Esto no es tuyo.')

  const filas = await db
    .update(productos)
    .set({ disponible })
    .where(and(eq(productos.id, id), eq(productos.proveedorId, ficha.id)))
    .returning({ id: productos.id })

  if (filas.length === 0) throw new ProductoRechazado('Esto no es tuyo.')
}

/**
 * Borrar de verdad, con su foto.
 *
 * ⚠ `ON DELETE CASCADE` borra la FILA de la imagen, no el objeto del
 * almacén: eso es código y se escribe aquí, junto al borrado, o el bucket
 * se queda con la foto de alguien que pidió que se fuera (regla de
 * producto 3).
 */
export async function borrarProducto(
  db: BaseDeDatos,
  id: string,
  llave: { usuarioId: string | null },
) {
  const ficha = await fichaDe(db, llave.usuarioId)
  if (!ficha) throw new ProductoRechazado('Esto no es tuyo.')

  const suyas = await db
    .select({ ruta: imagenes.ruta, estado: imagenes.estado })
    .from(imagenes)
    .where(and(eq(imagenes.objetoTipo, 'producto'), eq(imagenes.objetoId, id)))

  const filas = await db
    .delete(productos)
    .where(and(eq(productos.id, id), eq(productos.proveedorId, ficha.id)))
    .returning({ id: productos.id })

  if (filas.length === 0) throw new ProductoRechazado('Esto no es tuyo.')

  // Después del borrado y sin tumbar la operación si el almacén falla: la
  // fila ya no está, y un objeto suelto lo barre el cron de huérfanas.
  for (const img of suyas) {
    const bucket = img.estado === 'aprobada' ? 'publico' : 'cuarentena'
    await borrar(bucket, `${img.ruta}.webp`).catch(() => {})
  }
}
