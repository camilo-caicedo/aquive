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
  servidoresPublicos,
  entidadesPublicas,
  zonas,
} from '@/db/esquema'
import { NOMBRE_GRUPO } from '@/contrato/servicios'
import type {
  Categoria,
  EnListado,
  Facetas,
  Ficha,
  Filtros,
  EntidadBreve,
  MiFicha,
  ProfesionalBreve,
  ZonaConGente,
} from '@/contrato/servicios'

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
  if (filtros.grupo) {
    condiciones.push(sql`${proveedoresPublicos.grupos} @> array[${filtros.grupo}]::text[]`)
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
        latitud: proveedoresPublicos.latitud,
        longitud: proveedoresPublicos.longitud,
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
      latitud: aNumeroONulo(f.latitud),
      longitud: aNumeroONulo(f.longitud),
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

/**
 * Los grupos de oficio con cuánta gente hay en cada uno.
 *
 * Se cuenta sobre `proveedor_oficios_publicos`, que ya aplica la regla de
 * producto 7: un cuidador de niños sin referencia confirmada no suma a
 * «Cuidado». Contar sobre la tabla inflaría el número con gente que la
 * pantalla siguiente no va a enseñar, y eso se lee como un error.
 */
export async function categorias(
  db: BaseDeDatos,
  filtros: { municipio?: string },
): Promise<Categoria[]> {
  const condiciones = filtros.municipio
    ? [eq(proveedoresPublicos.municipio, filtros.municipio)]
    : []

  const filas = await db
    .select({
      grupo: proveedorOficiosPublicos.grupo,
      // Personas distintas, no oficios: alguien con tres oficios de Hogar es
      // una persona, y decir «3 cerca» cuando hay una sola es mentir.
      cuantos: sql<number>`count(distinct ${proveedorOficiosPublicos.proveedorId})::int`,
      ejemplos: sql<string[]>`(array_agg(distinct ${proveedorOficiosPublicos.oficioNombre}))[1:3]`,
    })
    .from(proveedorOficiosPublicos)
    .innerJoin(
      proveedoresPublicos,
      eq(proveedoresPublicos.id, proveedorOficiosPublicos.proveedorId),
    )
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .groupBy(proveedorOficiosPublicos.grupo)
    .orderBy(desc(sql`count(distinct ${proveedorOficiosPublicos.proveedorId})`))

  return filas
    .filter((f) => f.grupo !== null)
    .map((f) => ({
      grupo: f.grupo!,
      nombre: NOMBRE_GRUPO[f.grupo!] ?? f.grupo!,
      cuantos: aNumero(f.cuantos),
      ejemplos: f.ejemplos ?? [],
    }))
}

/**
 * Las zonas con gente, agregadas.
 *
 * Devuelve CUÁNTOS por zona y nada más. No hay coordenadas en la base y no
 * las va a haber: la granularidad máxima es barrio o comuna (regla de
 * producto 10). Publicar la ubicación puntual de alguien que trabaja solo en
 * la calle, con su nombre y su teléfono al lado, es un dato que sirve para
 * encontrarlo.
 */
export async function zonasConGente(
  db: BaseDeDatos,
  filtros: { municipio?: string },
): Promise<ZonaConGente[]> {
  const condiciones = filtros.municipio
    ? [eq(proveedoresPublicos.municipio, filtros.municipio)]
    : []

  const filas = await db
    .select({
      id: zonas.id,
      nombre: zonas.nombre,
      municipio: zonas.municipio,
      municipioNombre: municipios.nombre,
      cuantos: sql<number>`count(${proveedoresPublicos.id})::int`,
    })
    .from(zonas)
    .innerJoin(proveedoresPublicos, eq(proveedoresPublicos.zonaId, zonas.id))
    .leftJoin(municipios, eq(municipios.codigoDane, zonas.municipio))
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .groupBy(zonas.id, zonas.nombre, zonas.municipio, municipios.nombre)
    .orderBy(desc(sql`count(${proveedoresPublicos.id})`), asc(zonas.nombre))

  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    municipio: f.municipio,
    municipio_nombre: f.municipioNombre ?? null,
    cuantos: aNumero(f.cuantos),
  }))
}

/**
 * El día y la franja de AHORA en Colombia.
 *
 * En UTC el servidor cambia de día a las 7 p. m. hora de Cali, así que una
 * lista de «quién trabaja hoy» calculada en UTC se vaciaría a media tarde y
 * volvería a llenarse con la gente del día siguiente. La zona va escrita.
 */
function ahoraEnColombia(): { dia: string; franja: string } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date())

  const dias: Record<string, string> = {
    Mon: 'lun',
    Tue: 'mar',
    Wed: 'mie',
    Thu: 'jue',
    Fri: 'vie',
    Sat: 'sab',
    Sun: 'dom',
  }
  const dia = dias[partes.find((p) => p.type === 'weekday')?.value ?? 'Mon'] ?? 'lun'
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? 12)

  // Los mismos cortes que usa la interfaz al pedir la franja: mañana hasta
  // las 12, tarde hasta las 18, noche el resto.
  const franja = hora < 12 ? 'manana' : hora < 18 ? 'tarde' : 'noche'
  return { dia, franja }
}

/**
 * Lo que llena la portada.
 *
 * Tres consultas en una llamada, porque son tres tiras de la misma pantalla y
 * pedirlas por separado desde el cliente sería tres viajes para pintar un
 * primer pantallazo.
 */
export async function inicio(
  db: BaseDeDatos,
  filtros: { municipio?: string },
): Promise<{
  disponibles: EnListado[]
  profesionales: ProfesionalBreve[]
  entidades: EntidadBreve[]
}> {
  const { dia, franja } = ahoraEnColombia()

  const cerca = filtros.municipio
    ? eq(proveedoresPublicos.municipio, filtros.municipio)
    : undefined

  const [filas, profesionales, entidades] = await Promise.all([
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
        latitud: proveedoresPublicos.latitud,
        longitud: proveedoresPublicos.longitud,
      })
      .from(proveedoresPublicos)
      .leftJoin(municipios, eq(municipios.codigoDane, proveedoresPublicos.municipio))
      .where(
        and(
          sql`${proveedoresPublicos.dias} @> array[${dia}]::text[]`,
          sql`${proveedoresPublicos.franjas} @> array[${franja}]::text[]`,
          ...(cerca ? [cerca] : []),
        ),
      )
      .orderBy(
        desc(proveedoresPublicos.telefonoVerificado),
        desc(proveedoresPublicos.serviciosConfirmados),
      )
      .limit(12),
    db
      .select({
        id: servidoresPublicos.id,
        nombre_visible: servidoresPublicos.nombreVisible,
        profesion: servidoresPublicos.profesion,
        verificado: servidoresPublicos.verificado,
        municipios: servidoresPublicos.municipios,
      })
      .from(servidoresPublicos)
      // Los que alguien ya revisó, primero. Es la única señal comprobada que
      // hay en esta tira, y la ficha explica qué significa.
      .orderBy(desc(servidoresPublicos.verificado))
      .limit(12),
    db
      .select({
        id: entidadesPublicas.id,
        nombre: entidadesPublicas.nombre,
        subtitulo: entidadesPublicas.subtitulo,
        cobertura: entidadesPublicas.cobertura,
      })
      .from(entidadesPublicas)
      .orderBy(asc(entidadesPublicas.orden))
      .limit(12),
  ])

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
    disponibles: filas.map((f) => ({
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
      latitud: aNumeroONulo(f.latitud),
      longitud: aNumeroONulo(f.longitud),
      oficios: porProveedor.get(f.id!) ?? [],
    })),
    profesionales: profesionales.map((p) => ({
      id: p.id!,
      nombre_visible: p.nombre_visible ?? '',
      profesion: p.profesion,
      verificado: p.verificado ?? false,
      municipios: p.municipios ?? [],
    })),
    entidades: entidades.map((e) => ({
      id: e.id!,
      nombre: e.nombre ?? '',
      subtitulo: e.subtitulo,
      cobertura: e.cobertura ?? 'local',
    })),
  }
}
