import { createHash, randomBytes } from 'node:crypto'

import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import {
  muroPublico,
  perfiles,
  productosPublicos,
  publicacionesMuro,
} from '@/db/esquema'
import { contienePII } from '@/lib/validacion'
import { urlPublica } from '@/server/imagenes/almacen'
import { enlazar } from '@/server/imagenes/recorrido'
import type { Cara, EnMuro, Producto } from '@/contrato/comunidad'

export class MuroRechazado extends Error {}

/** La versión del texto que acepta quien publica su nombre en el muro. */
export const VERSION_AUTORIZACION_MURO = 'muro-v1'

function conUrl<T extends { imagen: string | null }>(fila: T): T {
  return fila.imagen ? { ...fila, imagen: urlPublica(`${fila.imagen}.webp`) } : fila
}

export async function muro(
  db: BaseDeDatos,
  filtros: { cara: Cara; municipio?: string; categoria?: string },
): Promise<EnMuro[]> {
  const condiciones = [eq(muroPublico.cara, filtros.cara)]
  if (filtros.municipio) condiciones.push(eq(muroPublico.municipio, filtros.municipio))
  if (filtros.categoria) condiciones.push(eq(muroPublico.categoria, filtros.categoria))

  const filas = await db
    .select()
    .from(muroPublico)
    .where(and(...condiciones))
    .orderBy(desc(muroPublico.creadaAt))
    .limit(60)

  return filas.map((f) =>
    conUrl({
      id: f.id!,
      cara: f.cara as Cara,
      categoria: f.categoria ?? 'otros',
      titulo: f.titulo ?? '',
      detalle: f.detalle,
      municipio: f.municipio ?? '',
      municipio_nombre: f.municipioNombre,
      zona_nombre: f.zonaNombre,
      autor_nombre: f.autorNombre,
      creada_at: String(f.creadaAt),
      imagen: f.imagen,
    }),
  )
}

/**
 * Publicar en el muro.
 *
 * Las dos caras se guardan distinto, y esa asimetría es la regla de producto
 * 4. La base la sostiene con dos CHECK; aquí se comprueba antes para poder
 * explicar el rechazo en castellano en vez de devolver un error de Postgres.
 */
export async function publicar(
  db: BaseDeDatos,
  entrada: {
    cara: Cara
    categoria: string
    titulo: string
    detalle?: string
    municipio: string
    zona_id?: string
    imagen_id?: string
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

  if (entrada.cara === 'ofrece') {
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
      })
      .returning({ id: publicacionesMuro.id })

    if (entrada.imagen_id) await enlazar(db, entrada.imagen_id, fila.id)
    return { id: fila.id, token: null }
  }

  // Cara «necesita»: sin cuenta y sin un solo dato. Mismo mecanismo que una
  // solicitud de insumos — 32 bytes, se guarda solo el hash, se muestra una
  // vez. Ese token es lo único que le permite volver a borrar lo suyo.
  const token = randomBytes(32).toString('base64url')
  const [fila] = await db
    .insert(publicacionesMuro)
    .values({
      cara: 'necesita',
      tokenHash: createHash('sha256').update(token).digest('hex'),
      categoria: entrada.categoria,
      titulo: entrada.titulo,
      detalle: entrada.detalle ?? null,
      municipio: entrada.municipio,
      zonaId: entrada.zona_id ?? null,
      expiraAt: sql`now() + interval '15 days'`,
    })
    .returning({ id: publicacionesMuro.id })

  if (entrada.imagen_id) await enlazar(db, entrada.imagen_id, fila.id)
  return { id: fila.id, token }
}

export async function productos(
  db: BaseDeDatos,
  filtros: {
    municipio?: string
    busqueda?: string
    grupo?: string
    modo?: string
    limite?: number
  },
): Promise<Producto[]> {
  const condiciones = []
  if (filtros.municipio) condiciones.push(eq(productosPublicos.municipio, filtros.municipio))
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

  return filas.map((f) =>
    conUrl({
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
    }),
  )
}
