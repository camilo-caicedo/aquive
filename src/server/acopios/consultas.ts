import { and, desc, eq, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import {
  acopiosPublicos,
  catalogoItems,
  entregas,
  miembrosOrganizacion,
  organizaciones,
  sugerenciasItem,
} from '@/db/esquema'
import { contienePII } from '@/lib/validacion'
import type { Acopio, Movimiento } from '@/contrato/acopios'

export class AcopioRechazado extends Error {}

/**
 * Los centros de acopio que se pueden enseñar (ADR 0008).
 *
 * Se lee de `acopios_publicos` y nunca de la tabla: el filtro de `activa`
 * vive en la vista, y duplicarlo en cada consulta es cómo un día una copia
 * se olvida y aparece en la lista un centro que cerró.
 */
export async function lista(
  db: BaseDeDatos,
  filtros: { municipio?: string },
): Promise<Acopio[]> {
  const filas = await db
    .select()
    .from(acopiosPublicos)
    .where(
      // El municipio va dentro del arreglo: un centro puede operar en
      // varios, y tiene que salir en todos ellos.
      filtros.municipio
        ? sql`${acopiosPublicos.municipios} @> array[${filtros.municipio}]::text[]`
        : undefined,
    )
    .orderBy(acopiosPublicos.nombre)

  return filas.map((f) => ({
    id: f.id!,
    nombre: f.nombre ?? '',
    tipo: f.tipo ?? 'otra',
    municipios: f.municipios ?? [],
    direccion: f.direccionAcopio,
    horario: f.horarioAcopio,
    telefono: f.telefono,
    // `numeric` llega como texto desde Postgres, que es lo correcto: no
    // cabe en un `number` sin perder precisión. Una coordenada sí cabe.
    latitud: f.latitud === null ? null : Number(f.latitud),
    longitud: f.longitud === null ? null : Number(f.longitud),
  }))
}

/** ¿Es esta persona del equipo de ese centro, y sigue activo? */
async function esDelEquipo(db: BaseDeDatos, organizacionId: string, perfilId: string) {
  const [m] = await db
    .select({ id: miembrosOrganizacion.perfilId })
    .from(miembrosOrganizacion)
    .innerJoin(organizaciones, eq(organizaciones.id, miembrosOrganizacion.organizacionId))
    .where(
      and(
        eq(miembrosOrganizacion.organizacionId, organizacionId),
        eq(miembrosOrganizacion.perfilId, perfilId),
        eq(miembrosOrganizacion.estado, 'activo'),
        eq(organizaciones.activa, true),
      ),
    )
    .limit(1)
  return Boolean(m)
}

/**
 * Lo que ha entrado y salido de un centro, lo más nuevo primero.
 *
 * El nombre del ítem sale del catálogo o de la sugerencia con que se
 * escribió, igual que en una solicitud: es la misma disyuntiva y el mismo
 * `check` de `num_nonnulls(item_id, sugerencia_id) = 1`.
 */
export async function movimientos(
  db: BaseDeDatos,
  organizacionId: string,
  llave: { usuarioId: string | null },
): Promise<Movimiento[]> {
  if (!llave.usuarioId) return []
  if (!(await esDelEquipo(db, organizacionId, llave.usuarioId))) return []

  const filas = await db
    .select({
      id: entregas.id,
      direccion: entregas.direccion,
      nombre: sql<string>`coalesce(${catalogoItems.nombre}, ${sugerenciasItem.nombrePropuesto})`,
      cantidad: entregas.cantidad,
      unidad: sql<string>`coalesce(${catalogoItems.unidad}, ${sugerenciasItem.unidadSugerida}, 'unidad')`,
      municipio: entregas.municipio,
      solicitudCodigo: entregas.solicitudCodigo,
      recibidoAt: entregas.recibidoAt,
    })
    .from(entregas)
    .leftJoin(catalogoItems, eq(catalogoItems.id, entregas.itemId))
    .leftJoin(sugerenciasItem, eq(sugerenciasItem.id, entregas.sugerenciaId))
    .where(eq(entregas.organizacionId, organizacionId))
    .orderBy(desc(entregas.recibidoAt))
    .limit(200)

  return filas.map((f) => ({
    id: f.id,
    direccion: f.direccion as 'entra' | 'sale',
    nombre: f.nombre,
    cantidad: Number(f.cantidad),
    unidad: f.unidad,
    municipio: f.municipio,
    solicitud_codigo: f.solicitudCodigo,
    recibido_at: String(f.recibidoAt),
  }))
}

/**
 * Anotar que algo entró o salió.
 *
 * ⚠ De aquí NO sale ni entra un dato personal. Quien lo trajo, quién se lo
 * llevó y para quién era no se guardan: la regla de producto 3 dice que
 * `entregas` sobrevive al borrado de lo que la originó, y solo puede
 * sobrevivir si no lleva nada de nadie. Por eso tampoco hay llave foránea
 * hacia la solicitud; su código va copiado como texto.
 */
export async function registrarMovimiento(
  db: BaseDeDatos,
  entrada: {
    organizacion_id: string
    direccion: 'entra' | 'sale'
    item_id?: string
    sugerencia?: string
    cantidad: number
    municipio: string
    solicitud_codigo?: string
  },
  llave: { usuarioId: string | null },
): Promise<{ id: string }> {
  if (!llave.usuarioId) throw new AcopioRechazado('No autorizado.')
  if (!(await esDelEquipo(db, entrada.organizacion_id, llave.usuarioId))) {
    throw new AcopioRechazado('No perteneces a ese centro.')
  }

  if (!entrada.item_id && !entrada.sugerencia) {
    throw new AcopioRechazado('Di qué entró o salió.')
  }
  if (entrada.item_id && entrada.sugerencia) {
    throw new AcopioRechazado('Del catálogo o escrito a mano, no las dos cosas.')
  }

  let itemId: string | null = null
  let sugerenciaId: string | null = null

  if (entrada.item_id) {
    const [existe] = await db
      .select({ id: catalogoItems.id })
      .from(catalogoItems)
      .where(and(eq(catalogoItems.id, entrada.item_id), eq(catalogoItems.activo, true)))
      .limit(1)
    if (!existe) throw new AcopioRechazado('Ese ítem ya no está en la lista.')
    itemId = existe.id
  } else {
    const texto = entrada.sugerencia!.trim()
    // Lo escribe una persona del equipo, pero lo va a leer quien modere el
    // catálogo: mismo filtro que en todo lo demás (regla de producto 4).
    if (contienePII(texto)) {
      throw new AcopioRechazado('No escribas teléfonos, correos ni cédulas ahí.')
    }
    const [sug] = await db
      .insert(sugerenciasItem)
      .values({ nombrePropuesto: texto, origen: 'entrega' })
      .returning({ id: sugerenciasItem.id })
    sugerenciaId = sug.id
  }

  const [fila] = await db
    .insert(entregas)
    .values({
      organizacionId: entrada.organizacion_id,
      direccion: entrada.direccion,
      itemId,
      sugerenciaId,
      cantidad: String(entrada.cantidad),
      municipio: entrada.municipio,
      solicitudCodigo: entrada.solicitud_codigo?.trim().toUpperCase() || null,
      origenTipo: entrada.solicitud_codigo ? 'directo' : 'mostrador',
    })
    .returning({ id: entregas.id })

  return { id: fila.id }
}
