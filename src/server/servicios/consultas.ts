import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import {
  municipios,
  municipiosConProveedores,
  oficiosConProveedores,
  proveedorOficios,
  proveedorOficiosPublicos,
  proveedores,
  proveedoresPublicos,
  resenasPublicas,
  zonas,
} from '@/db/esquema'
import type { EnListado, Facetas, Ficha, Filtros, MiFicha } from '@/contrato/servicios'

// Capa de dominio del módulo de Servicios.
//
// Regla 1 de arquitectura del ADR 0001: aquí no se importa `next/*`. Estas
// funciones reciben la base y argumentos planos, y devuelven datos. Quien lee
// cookies, cabeceras o parámetros de ruta es el borde, y pasa el valor hacia
// adentro — es lo único que hace que esto sirva igual desde la web y desde la
// aplicación de Expo.
//
// Se lee de las VISTAS públicas (`proveedores_publicos`,
// `proveedor_oficios_publicos`, `resenas_publicas`), nunca de las tablas.
// No es comodidad: la regla de producto 7 —un oficio de riesgo alto no
// aparece sin teléfono verificado y una referencia confirmada— y el filtro de
// suspendidos viven dentro de esas vistas. Consultar la tabla directamente
// los saltaría sin que nadie se diera cuenta, y el precio de ese descuido lo
// paga alguien que contrata a un cuidador de niños sin respaldo.

/** Postgres devuelve `numeric` y `bigint` como texto para no perder precisión. */
function aNumero(v: unknown): number {
  if (v === null || v === undefined) return 0
  return typeof v === 'number' ? v : Number(v)
}

function aNumeroONulo(v: unknown): number | null {
  if (v === null || v === undefined) return null
  return typeof v === 'number' ? v : Number(v)
}

function aFecha(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

export async function ficha(db: BaseDeDatos, id: string): Promise<Ficha | null> {
  const [proveedor] = await db
    .select({
      id: proveedoresPublicos.id,
      nombreVisible: proveedoresPublicos.nombreVisible,
      tipo: proveedoresPublicos.tipo,
      telefono: proveedoresPublicos.telefono,
      telefonoVerificado: proveedoresPublicos.telefonoVerificado,
      municipio: proveedoresPublicos.municipio,
      municipioNombre: municipios.nombre,
      municipioDepartamento: municipios.departamento,
      zonaNombre: proveedoresPublicos.zonaNombre,
      zonaTexto: proveedoresPublicos.zonaTexto,
      modalidad: proveedoresPublicos.modalidad,
      dias: proveedoresPublicos.dias,
      franjas: proveedoresPublicos.franjas,
      mediosPago: proveedoresPublicos.mediosPago,
      descripcion: proveedoresPublicos.descripcion,
      creadoAt: proveedoresPublicos.creadoAt,
      referenciasConfirmadas: proveedoresPublicos.referenciasConfirmadas,
      serviciosConfirmados: proveedoresPublicos.serviciosConfirmados,
      totalResenas: proveedoresPublicos.totalResenas,
      cumplimiento: proveedoresPublicos.cumplimiento,
      trato: proveedoresPublicos.trato,
      puntualidad: proveedoresPublicos.puntualidad,
    })
    .from(proveedoresPublicos)
    // El municipio se resolvía en una segunda consulta desde la pantalla. Va
    // aquí: la ficha es un dato, no dos, y así la aplicación móvil no tiene
    // que acordarse de pedir la segunda.
    .leftJoin(municipios, eq(municipios.codigoDane, proveedoresPublicos.municipio))
    .where(eq(proveedoresPublicos.id, id))
    .limit(1)

  if (!proveedor) return null

  const [oficios, resenas] = await Promise.all([
    db
      .select({
        oficio_id: proveedorOficiosPublicos.oficioId,
        nombre: proveedorOficiosPublicos.oficioNombre,
        grupo: proveedorOficiosPublicos.grupo,
        modo: proveedorOficiosPublicos.modo,
        precio_desde: proveedorOficiosPublicos.precioDesde,
        unidad: proveedorOficiosPublicos.unidad,
      })
      .from(proveedorOficiosPublicos)
      .where(eq(proveedorOficiosPublicos.proveedorId, id))
      .orderBy(asc(proveedorOficiosPublicos.oficioNombre)),
    db
      .select({
        id: resenasPublicas.id,
        cumplimiento: resenasPublicas.cumplimiento,
        trato: resenasPublicas.trato,
        puntualidad: resenasPublicas.puntualidad,
        comentario: resenasPublicas.comentario,
        replica: resenasPublicas.replica,
        creada_at: resenasPublicas.creadaAt,
      })
      .from(resenasPublicas)
      .where(eq(resenasPublicas.proveedorId, id))
      .orderBy(desc(resenasPublicas.creadaAt)),
  ])

  return {
    id: proveedor.id!,
    nombre_visible: proveedor.nombreVisible ?? '',
    tipo: proveedor.tipo ?? 'persona',
    telefono: proveedor.telefono,
    telefono_verificado: proveedor.telefonoVerificado ?? false,
    municipio: proveedor.municipio ?? '',
    municipio_nombre: proveedor.municipioNombre ?? null,
    municipio_departamento: proveedor.municipioDepartamento ?? null,
    zona_nombre: proveedor.zonaNombre,
    zona_texto: proveedor.zonaTexto,
    modalidad: (proveedor.modalidad ?? []) as Ficha['modalidad'],
    dias: (proveedor.dias ?? []) as Ficha['dias'],
    franjas: (proveedor.franjas ?? []) as Ficha['franjas'],
    medios_pago: (proveedor.mediosPago ?? []) as Ficha['medios_pago'],
    descripcion: proveedor.descripcion,
    creado_at: aFecha(proveedor.creadoAt),
    referencias_confirmadas: aNumero(proveedor.referenciasConfirmadas),
    servicios_confirmados: aNumero(proveedor.serviciosConfirmados),
    total_resenas: aNumero(proveedor.totalResenas),
    cumplimiento: aNumeroONulo(proveedor.cumplimiento),
    trato: aNumeroONulo(proveedor.trato),
    puntualidad: aNumeroONulo(proveedor.puntualidad),
    oficios: oficios.map((o) => ({
      oficio_id: o.oficio_id!,
      nombre: o.nombre ?? '',
      grupo: o.grupo,
      modo: (o.modo ?? 'normal') as Ficha['oficios'][number]['modo'],
      precio_desde: aNumeroONulo(o.precio_desde),
      unidad: o.unidad as Ficha['oficios'][number]['unidad'],
    })),
    resenas: resenas.map((r) => ({
      id: r.id!,
      cumplimiento: aNumeroONulo(r.cumplimiento),
      trato: aNumeroONulo(r.trato),
      puntualidad: aNumeroONulo(r.puntualidad),
      comentario: r.comentario,
      replica: r.replica,
      creada_at: aFecha(r.creada_at),
    })),
  }
}

export async function directorio(
  db: BaseDeDatos,
  filtros: Filtros,
): Promise<{ filas: EnListado[]; facetas: Facetas }> {
  const condiciones = []
  if (filtros.municipio) condiciones.push(eq(proveedoresPublicos.municipio, filtros.municipio))
  if (filtros.zona) condiciones.push(eq(proveedoresPublicos.zonaId, filtros.zona))
  // Los arreglos agregados de la vista ya traen solo lo visible de cada
  // prestador. Cruzar contra la tabla de oficios devolvería los que la regla
  // de producto 7 esconde.
  if (filtros.oficio) {
    condiciones.push(sql`${proveedoresPublicos.oficios} @> array[${filtros.oficio}]::text[]`)
  }
  if (filtros.modalidad) {
    condiciones.push(sql`${proveedoresPublicos.modalidad} @> array[${filtros.modalidad}]::text[]`)
  }
  if (filtros.modo) {
    condiciones.push(sql`${proveedoresPublicos.modos} @> array[${filtros.modo}]::text[]`)
  }
  const donde = condiciones.length > 0 ? and(...condiciones) : undefined

  const [filas, oficiosCatalogo, municipiosCatalogo, zonasDelMunicipio] = await Promise.all([
    db
      .select({
        id: proveedoresPublicos.id,
        nombreVisible: proveedoresPublicos.nombreVisible,
        tipo: proveedoresPublicos.tipo,
        telefonoVerificado: proveedoresPublicos.telefonoVerificado,
        municipio: proveedoresPublicos.municipio,
        municipioNombre: municipios.nombre,
        zonaNombre: proveedoresPublicos.zonaNombre,
        zonaTexto: proveedoresPublicos.zonaTexto,
        modalidad: proveedoresPublicos.modalidad,
        referenciasConfirmadas: proveedoresPublicos.referenciasConfirmadas,
        serviciosConfirmados: proveedoresPublicos.serviciosConfirmados,
        totalResenas: proveedoresPublicos.totalResenas,
        cumplimiento: proveedoresPublicos.cumplimiento,
        descripcion: proveedoresPublicos.descripcion,
      })
      .from(proveedoresPublicos)
      .leftJoin(municipios, eq(municipios.codigoDane, proveedoresPublicos.municipio))
      .where(donde)
      // Verificados primero, y después quien tiene servicios confirmados. Las
      // dos son señales comprobadas, no una recomendación: la ficha lo dice.
      .orderBy(
        desc(proveedoresPublicos.telefonoVerificado),
        desc(proveedoresPublicos.serviciosConfirmados),
        asc(proveedoresPublicos.nombreVisible),
      ),
    db
      .select({
        id: oficiosConProveedores.id,
        nombre: oficiosConProveedores.nombre,
        grupo: oficiosConProveedores.grupo,
      })
      .from(oficiosConProveedores)
      .orderBy(asc(oficiosConProveedores.orden)),
    db
      .select({
        codigo_dane: municipiosConProveedores.codigoDane,
        nombre: municipiosConProveedores.nombre,
        departamento: municipiosConProveedores.departamento,
      })
      .from(municipiosConProveedores)
      .orderBy(asc(municipiosConProveedores.nombre)),
    filtros.municipio
      ? db
          .select({ id: zonas.id, nombre: zonas.nombre })
          .from(zonas)
          .where(and(eq(zonas.municipio, filtros.municipio), eq(zonas.activa, true)))
          .orderBy(asc(zonas.orden))
      : Promise.resolve([]),
  ])

  // Los oficios de todos los prestadores de la página, en UNA consulta en vez
  // de una por tarjeta.
  const ids = filas.map((f) => f.id!).filter(Boolean)
  const oficios = ids.length
    ? await db
        .select({
          proveedorId: proveedorOficiosPublicos.proveedorId,
          oficio_id: proveedorOficiosPublicos.oficioId,
          nombre: proveedorOficiosPublicos.oficioNombre,
          grupo: proveedorOficiosPublicos.grupo,
          modo: proveedorOficiosPublicos.modo,
          precio_desde: proveedorOficiosPublicos.precioDesde,
          unidad: proveedorOficiosPublicos.unidad,
        })
        .from(proveedorOficiosPublicos)
        .where(inArray(proveedorOficiosPublicos.proveedorId, ids))
        .orderBy(asc(proveedorOficiosPublicos.oficioNombre))
    : []

  const porProveedor = new Map<string, EnListado['oficios']>()
  for (const o of oficios) {
    const lista = porProveedor.get(o.proveedorId!) ?? []
    lista.push({
      oficio_id: o.oficio_id!,
      nombre: o.nombre ?? '',
      grupo: o.grupo,
      modo: (o.modo ?? 'normal') as EnListado['oficios'][number]['modo'],
      precio_desde: aNumeroONulo(o.precio_desde),
      unidad: o.unidad as EnListado['oficios'][number]['unidad'],
    })
    porProveedor.set(o.proveedorId!, lista)
  }

  return {
    filas: filas.map((f) => ({
      id: f.id!,
      nombre_visible: f.nombreVisible ?? '',
      tipo: f.tipo ?? 'persona',
      telefono_verificado: f.telefonoVerificado ?? false,
      municipio: f.municipio ?? '',
      municipio_nombre: f.municipioNombre ?? null,
      zona_nombre: f.zonaNombre,
      zona_texto: f.zonaTexto,
      modalidad: (f.modalidad ?? []) as EnListado['modalidad'],
      referencias_confirmadas: aNumero(f.referenciasConfirmadas),
      servicios_confirmados: aNumero(f.serviciosConfirmados),
      total_resenas: aNumero(f.totalResenas),
      cumplimiento: aNumeroONulo(f.cumplimiento),
      descripcion: f.descripcion,
      oficios: porProveedor.get(f.id!) ?? [],
    })),
    facetas: {
      oficios: oficiosCatalogo.map((o) => ({
        id: o.id!,
        nombre: o.nombre ?? '',
        grupo: o.grupo,
      })),
      municipios: municipiosCatalogo.map((m) => ({
        codigo_dane: m.codigo_dane!,
        nombre: m.nombre ?? '',
        departamento: m.departamento,
      })),
      zonas: zonasDelMunicipio.map((z) => ({ id: z.id, nombre: z.nombre })),
    },
  }
}

/**
 * La ficha propia de quien está en sesión.
 *
 * Se lee de `proveedores` —la tabla, no la vista— a propósito: una ficha
 * suspendida no sale en la vista pública, y es justo la que hay que poder
 * mirar para saber que está suspendida. Devuelve lo mínimo que la portada
 * necesita, no el perfil entero: quien quiere editarlo va a su pantalla.
 */
export async function miFicha(
  db: BaseDeDatos,
  usuarioId: string | null,
): Promise<MiFicha | null> {
  if (!usuarioId) return null

  const [mia] = await db
    .select({ id: proveedores.id, suspendido: proveedores.suspendido })
    .from(proveedores)
    .where(eq(proveedores.perfilId, usuarioId))
    .limit(1)

  if (!mia) return null

  // Cuántos de sus oficios esconde la regla de producto 7: los que tiene
  // declarados menos los que la vista pública deja ver.
  const [{ declarados }] = await db
    .select({ declarados: sql<number>`count(*)::int` })
    .from(proveedorOficios)
    .where(eq(proveedorOficios.proveedorId, mia.id))

  const [{ visibles }] = await db
    .select({ visibles: sql<number>`count(*)::int` })
    .from(proveedorOficiosPublicos)
    .where(eq(proveedorOficiosPublicos.proveedorId, mia.id))

  return {
    id: mia.id,
    suspendido: mia.suspendido,
    oficios_escondidos: Math.max(0, declarados - visibles),
  }
}
