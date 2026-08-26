import { and, asc, desc, eq, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import {
  municipios,
  proveedorOficiosPublicos,
  proveedoresPublicos,
  resenasPublicas,
} from '@/db/esquema'
import type { EnListado, Ficha } from '@/contrato/servicios'

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

export async function listado(
  db: BaseDeDatos,
  filtros: { oficio?: string; municipio?: string; limite: number; desde: number },
): Promise<{ filas: EnListado[]; hay_mas: boolean }> {
  const condiciones = []
  if (filtros.municipio) condiciones.push(eq(proveedoresPublicos.municipio, filtros.municipio))
  // El oficio se busca contra el arreglo agregado de la vista, que ya trae
  // solo los oficios visibles de cada prestador. Filtrar aquí por la tabla de
  // oficios traería de vuelta los escondidos por la regla 7.
  if (filtros.oficio) {
    condiciones.push(sql`${filtros.oficio} = any(${proveedoresPublicos.oficios})`)
  }

  // Se pide una fila de más en vez de contar el total: `count(*)` sobre una
  // vista con agregados cuesta lo mismo que traer la página entera, y para
  // pintar «hay más» no hace falta saber cuántos.
  const filas = await db
    .select({
      id: proveedoresPublicos.id,
      nombreVisible: proveedoresPublicos.nombreVisible,
      tipo: proveedoresPublicos.tipo,
      telefonoVerificado: proveedoresPublicos.telefonoVerificado,
      municipio: proveedoresPublicos.municipio,
      zonaNombre: proveedoresPublicos.zonaNombre,
      zonaTexto: proveedoresPublicos.zonaTexto,
      modalidad: proveedoresPublicos.modalidad,
      referenciasConfirmadas: proveedoresPublicos.referenciasConfirmadas,
      serviciosConfirmados: proveedoresPublicos.serviciosConfirmados,
      totalResenas: proveedoresPublicos.totalResenas,
      cumplimiento: proveedoresPublicos.cumplimiento,
    })
    .from(proveedoresPublicos)
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    // Quien tiene servicios confirmados primero: es la única señal que no
    // depende de nosotros (regla de producto 5).
    .orderBy(desc(proveedoresPublicos.serviciosConfirmados), asc(proveedoresPublicos.nombreVisible))
    .limit(filtros.limite + 1)
    .offset(filtros.desde)

  const hay_mas = filas.length > filtros.limite

  return {
    hay_mas,
    filas: filas.slice(0, filtros.limite).map((f) => ({
      id: f.id!,
      nombre_visible: f.nombreVisible ?? '',
      tipo: f.tipo ?? 'persona',
      telefono_verificado: f.telefonoVerificado ?? false,
      municipio: f.municipio ?? '',
      zona_nombre: f.zonaNombre,
      zona_texto: f.zonaTexto,
      modalidad: (f.modalidad ?? []) as EnListado['modalidad'],
      referencias_confirmadas: aNumero(f.referenciasConfirmadas),
      servicios_confirmados: aNumero(f.serviciosConfirmados),
      total_resenas: aNumero(f.totalResenas),
      cumplimiento: aNumeroONulo(f.cumplimiento),
    })),
  }
}
