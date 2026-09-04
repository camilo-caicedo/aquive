import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import {
  imagenes,
  municipios,
  muroPublico,
  perfiles,
  productosPublicos,
  publicacionesMuro,
  zonas,
} from '@/db/esquema'
import { contienePII } from '@/lib/validacion'
import { urlPublica } from '@/server/imagenes/almacen'
import { borrarImagenesDe, enlazar } from '@/server/imagenes/recorrido'
import type { EnMuro, MiPublicacionMuro, Producto } from '@/contrato/comunidad'

export class MuroRechazado extends Error {}

/** La versión del texto que acepta quien publica su nombre en el muro. */
export const VERSION_AUTORIZACION_MURO = 'muro-v1'

function conUrl<T extends { imagen: string | null }>(fila: T): T {
  return fila.imagen ? { ...fila, imagen: urlPublica(`${fila.imagen}.webp`) } : fila
}

export async function muro(
  db: BaseDeDatos,
  filtros: { municipio?: string; categoria?: string },
): Promise<EnMuro[]> {
  const condiciones = []
  if (filtros.municipio) condiciones.push(eq(muroPublico.municipio, filtros.municipio))
  if (filtros.categoria) condiciones.push(eq(muroPublico.categoria, filtros.categoria))

  const filas = await db
    .select()
    .from(muroPublico)
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .orderBy(desc(muroPublico.creadaAt))
    .limit(60)

  return filas.map((f) =>
    conUrl({
      id: f.id!,
      categoria: f.categoria ?? 'otros',
      titulo: f.titulo ?? '',
      detalle: f.detalle,
      municipio: f.municipio ?? '',
      municipio_nombre: f.municipioNombre,
      zona_nombre: f.zonaNombre,
      autor_nombre: f.autorNombre,
      creada_at: String(f.creadaAt),
      imagen: f.imagen,
      proveedor_id: f.proveedorId,
      telefono: f.telefono,
      telefono_verificado: f.telefonoVerificado ?? false,
      acopio_nombre: f.acopioNombre,
      acopio_direccion: f.acopioDireccion,
    }),
  )
}

/**
 * Publicar en el muro.
 *
 * Regla de producto 4: publica con nombre y consentimiento. La base la
 * sostiene con un CHECK; aquí se comprueba antes para poder explicar el
 * rechazo en castellano en vez de devolver un error de Postgres.
 */
export async function publicar(
  db: BaseDeDatos,
  entrada: {
    categoria: string
    titulo: string
    detalle?: string
    municipio: string
    zona_id?: string
    imagen_id?: string
    acopio_id?: string
    acepto_publicar_nombre: boolean
  },
  llave: { usuarioId: string | null },
): Promise<{ id: string; token: string | null }> {
  // Los dos campos libres, con su filtro. Un título con un teléfono dentro es
  // exactamente lo que la regla de producto 4 impide.
  for (const texto of [entrada.titulo, entrada.detalle ?? '']) {
    if (texto && contienePII(texto)) {
      throw new MuroRechazado(
        'No escribas teléfonos, correos ni cédulas. Quien lo necesite te va a escribir por aquí.',
      )
    }
  }

  if (!llave.usuarioId) {
    throw new MuroRechazado('Para ofrecer algo necesitas entrar con tu cuenta.')
  }
  if (!entrada.acepto_publicar_nombre) {
    throw new MuroRechazado(
      'Para ofrecer algo hay que aceptar que tu nombre aparezca junto a la publicación.',
    )
  }

  const [perfil] = await db
    .select({ id: perfiles.id, nombre: perfiles.nombreVisible })
    .from(perfiles)
    .where(eq(perfiles.id, llave.usuarioId))
    .limit(1)

  if (!perfil) throw new MuroRechazado('No encontramos tu perfil.')

  const [fila] = await db
    .insert(publicacionesMuro)
    .values({
      cara: 'ofrece',
      perfilId: perfil.id,
      autorNombre: perfil.nombre,
      autorizacionVersion: VERSION_AUTORIZACION_MURO,
      autorizacionAt: new Date().toISOString(),
      categoria: entrada.categoria,
      titulo: entrada.titulo,
      detalle: entrada.detalle ?? null,
      municipio: entrada.municipio,
      zonaId: entrada.zona_id ?? null,
      acopioId: entrada.acopio_id ?? null,
    })
    .returning({ id: publicacionesMuro.id })

  if (entrada.imagen_id) await enlazar(db, entrada.imagen_id, fila.id)
  return { id: fila.id, token: null }
}

export async function productos(
  db: BaseDeDatos,
  filtros: {
    municipio?: string
    busqueda?: string
    grupo?: string
    modo?: string
    proveedor?: string
    limite?: number
  },
): Promise<Producto[]> {
  const condiciones = []
  if (filtros.municipio) condiciones.push(eq(productosPublicos.municipio, filtros.municipio))
  if (filtros.proveedor) {
    condiciones.push(eq(productosPublicos.proveedorId, filtros.proveedor))
  }
  if (filtros.modo) condiciones.push(eq(productosPublicos.modo, filtros.modo))
  // La familia de oficio de quien vende, que es un arreglo: quien cocina
  // puede tener también «aseo» declarado y sale en las dos.
  if (filtros.grupo) {
    condiciones.push(sql`${productosPublicos.grupos} @> array[${filtros.grupo}]::text[]`)
  }
  if (filtros.busqueda) {
    const patron = `%${filtros.busqueda}%`
    condiciones.push(
      or(
        ilike(productosPublicos.nombre, patron),
        ilike(productosPublicos.detalle, patron),
        ilike(productosPublicos.proveedorNombre, patron),
      )!,
    )
  }

  const filas = await db
    .select()
    .from(productosPublicos)
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .orderBy(desc(productosPublicos.creadoAt))
    .limit(filtros.limite ?? 60)

  return filas.map(comoProducto)
}

/**
 * Una fila de `productos_publicos` como la ve el contrato.
 *
 * Está aparte porque la lista y el detalle tienen que devolver exactamente
 * lo mismo: dos copias de este mapeo son dos sitios donde el precio puede
 * empezar a leerse distinto según por dónde se haya llegado.
 */
function comoProducto(f: typeof productosPublicos.$inferSelect): Producto {
  return conUrl({
    id: f.id!,
    proveedor_id: f.proveedorId!,
    proveedor_nombre: f.proveedorNombre ?? '',
    municipio: f.municipio ?? '',
    zona_nombre: f.zonaNombre,
    nombre: f.nombre ?? '',
    detalle: f.detalle,
    modo: (f.modo ?? 'normal') as Producto['modo'],
    precio_desde: f.precioDesde === null ? null : Number(f.precioDesde),
    unidad: f.unidad as Producto['unidad'],
    imagen: f.imagen,
    telefono: f.telefono,
    telefono_verificado: f.telefonoVerificado ?? false,
    grupos: f.grupos ?? [],
    creado_at: f.creadoAt ?? '',
  })
}

/**
 * Un producto por su id.
 *
 * De la vista pública, igual que la lista: así el producto apagado y el de
 * quien retiró su ficha desaparecen de las dos puertas a la vez.
 */
export async function producto(db: BaseDeDatos, id: string): Promise<Producto | null> {
  const [fila] = await db
    .select()
    .from(productosPublicos)
    .where(eq(productosPublicos.id, id))
    .limit(1)

  return fila ? comoProducto(fila) : null
}

/**
 * Lo que yo publiqué en el muro.
 *
 * De la TABLA y no de la vista pública, a propósito: aquí hay que ver
 * también lo que tiene la foto sin aprobar y lo que ya venció. La vista
 * existe para esconderle eso a quien busca, no a quien lo escribió — mismo
 * criterio que `productos.mios`.
 */
export async function misPublicaciones(
  db: BaseDeDatos,
  usuarioId: string | null,
): Promise<MiPublicacionMuro[]> {
  if (!usuarioId) return []

  const filas = await db
    .select({
      id: publicacionesMuro.id,
      categoria: publicacionesMuro.categoria,
      titulo: publicacionesMuro.titulo,
      detalle: publicacionesMuro.detalle,
      municipio: publicacionesMuro.municipio,
      municipioNombre: municipios.nombre,
      zonaNombre: zonas.nombre,
      creadaAt: publicacionesMuro.creadaAt,
      expiraAt: publicacionesMuro.expiraAt,
      imagen: imagenes.ruta,
      estadoImagen: imagenes.estado,
      motivoImagen: imagenes.motivo,
    })
    .from(publicacionesMuro)
    .leftJoin(municipios, eq(municipios.codigoDane, publicacionesMuro.municipio))
    .leftJoin(zonas, eq(zonas.id, publicacionesMuro.zonaId))
    .leftJoin(
      imagenes,
      and(eq(imagenes.objetoTipo, 'muro'), eq(imagenes.objetoId, publicacionesMuro.id)),
    )
    .where(eq(publicacionesMuro.perfilId, usuarioId))
    .orderBy(desc(publicacionesMuro.creadaAt))

  return filas.map((f) => ({
    id: f.id,
    categoria: f.categoria,
    titulo: f.titulo,
    detalle: f.detalle,
    municipio: f.municipio,
    municipio_nombre: f.municipioNombre,
    zona_nombre: f.zonaNombre,
    creada_at: String(f.creadaAt),
    expira_at: f.expiraAt ? String(f.expiraAt) : null,
    // La suya, aprobada o no: la URL pública solo existe para la aprobada,
    // y para las demás basta con saber en qué van.
    imagen:
      f.imagen && f.estadoImagen === 'aprobada' ? urlPublica(`${f.imagen}.webp`) : null,
    estado_imagen: (f.estadoImagen ?? null) as MiPublicacionMuro['estado_imagen'],
    motivo_imagen: f.motivoImagen,
  }))
}

/**
 * Borrar una publicación propia, con su foto.
 *
 * ⚠ Borrado de verdad: la fila se va (regla de producto 3, «Nunca
 * `estado = 'eliminada'`»). La publicación lleva el nombre de esa persona y
 * la versión de la autorización que firmó, así que marcarla como resuelta
 * sería seguir publicando lo que pidió retirar.
 *
 * Y borra el objeto del almacén, que `ON DELETE CASCADE` no hace.
 *
 * El `where` lleva SIEMPRE el perfil: es lo que impide borrar la
 * publicación de otro sabiendo su id, y va en la consulta y no en un `if`
 * de arriba — un `if` se puede saltar reordenando el código, un `where` no.
 */
export async function borrarPublicacion(
  db: BaseDeDatos,
  id: string,
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) throw new MuroRechazado('Esto no es tuyo.')

  const [mia] = await db
    .select({ id: publicacionesMuro.id })
    .from(publicacionesMuro)
    .where(
      and(
        eq(publicacionesMuro.id, id),
        eq(publicacionesMuro.perfilId, llave.usuarioId),
      ),
    )
    .limit(1)

  if (!mia) throw new MuroRechazado('Esto no es tuyo.')

  await borrarImagenesDe(db, [{ tipo: 'muro', id }])
  await db.delete(publicacionesMuro).where(eq(publicacionesMuro.id, id))

  return { ok: true }
}
