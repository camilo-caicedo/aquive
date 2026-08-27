import { and, eq, inArray, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import {
  catalogoOficios,
  proveedorOficiosSugeridos,
  proveedores,
  sugerenciasItem,
} from '@/db/esquema'
import { validarSugerencia } from '@/lib/validacion'
import { TOPE_OFICIOS } from '@/lib/servicios'
import type { GrupoOficio, OficioPropuesto, Subcategoria } from '@/contrato/servicios'

export class PropuestaRechazada extends Error {}

/**
 * Las subcategorías que un prestador propuso y todavía no existen (ADR 0013).
 *
 * ⚠ Vive aparte de `guardar_proveedor` a propósito, por el mismo motivo que
 * la foto: esa RPC escribe la ficha entera de una vez y funciona, y es
 * PL/pgSQL con muchas manos encima. Meterle una escritura nueva a una
 * función grande que ya sirve es cómo se rompe lo que sí andaba. Esto es
 * una escritura pequeña, nueva y separable, así que nace donde el ADR 0001
 * dice que tienen que nacer: en el contrato.
 *
 * ⚠ Nada de esto se publica. `proveedor_oficios_publicos` hace `join` contra
 * `catalogo_oficios`, así que un oficio que no está en el catálogo es
 * invisible para el público **por construcción**, no por un filtro que
 * alguien pueda olvidar de copiar a la siguiente consulta.
 */

/** La ficha de quien llama, o nada. */
async function miFicha(db: BaseDeDatos, perfilId: string) {
  const [ficha] = await db
    .select({ id: proveedores.id })
    .from(proveedores)
    .where(eq(proveedores.perfilId, perfilId))
    .limit(1)
  return ficha ?? null
}

export async function mios(
  db: BaseDeDatos,
  llave: { usuarioId: string | null },
): Promise<OficioPropuesto[]> {
  if (!llave.usuarioId) return []
  const ficha = await miFicha(db, llave.usuarioId)
  if (!ficha) return []

  const filas = await db
    .select({
      sugerencia_id: proveedorOficiosSugeridos.sugerenciaId,
      nombre: sugerenciasItem.nombrePropuesto,
      grupo: sugerenciasItem.grupoSugerido,
      estado: sugerenciasItem.estado,
      modo: proveedorOficiosSugeridos.modo,
      precio_desde: proveedorOficiosSugeridos.precioDesde,
      unidad: proveedorOficiosSugeridos.unidad,
    })
    .from(proveedorOficiosSugeridos)
    .innerJoin(
      sugerenciasItem,
      eq(sugerenciasItem.id, proveedorOficiosSugeridos.sugerenciaId),
    )
    .where(eq(proveedorOficiosSugeridos.proveedorId, ficha.id))

  return filas.map((f) => ({
    sugerencia_id: f.sugerencia_id,
    nombre: f.nombre,
    grupo: (f.grupo ?? 'otros') as GrupoOficio,
    estado: f.estado,
    modo: f.modo as OficioPropuesto['modo'],
    precio_desde: f.precio_desde === null ? null : Number(f.precio_desde),
    unidad: f.unidad as OficioPropuesto['unidad'],
  }))
}

/**
 * Guardar la lista entera de propuestas de una ficha, de una vez.
 *
 * Reconcilia en vez de añadir: lo que no venga en la lista se quita. Es el
 * mismo trato que `guardar_proveedor` le da a los oficios de verdad, y así
 * el formulario no tiene que llevar la cuenta de qué borró.
 */
export async function guardar(
  db: BaseDeDatos,
  entrada: {
    propuestas: {
      nombre: string
      grupo: GrupoOficio
      modo: 'gratis' | 'aporte' | 'solidario' | 'normal'
      precio_desde?: number | null
      unidad?: string | null
    }[]
    /** Cuántos oficios del catálogo lleva ya la ficha, para el tope. */
    oficios_del_catalogo: number
  },
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) {
    throw new PropuestaRechazada('Para publicar tu ficha necesitas entrar con tu cuenta.')
  }
  const ficha = await miFicha(db, llave.usuarioId)
  if (!ficha) throw new PropuestaRechazada('Todavía no tienes ficha.')

  // El tope es de la ficha, no de cada lista: ocho cosas que esa persona
  // dice que hace, existan ya en el catálogo o no.
  if (entrada.oficios_del_catalogo + entrada.propuestas.length > TOPE_OFICIOS) {
    throw new PropuestaRechazada(`Puedes tener máximo ${TOPE_OFICIOS} oficios en tu ficha.`)
  }

  for (const p of entrada.propuestas) {
    const error = validarSugerencia(p.nombre)
    if (error) throw new PropuestaRechazada(error)
    // El gemelo de `precio_solo_si_cobra` en la base. Se comprueba aquí
    // para poder decir por qué, en vez de dejar que rebote con el nombre
    // de una restricción que nadie fuera de este repositorio entiende.
    if (p.precio_desde != null && p.modo !== 'solidario' && p.modo !== 'normal') {
      throw new PropuestaRechazada('Si es gratis o a voluntad, no lleva precio.')
    }
    if (p.precio_desde != null && !p.unidad) {
      throw new PropuestaRechazada('Di por qué cobras ese precio: por hora, por trabajo…')
    }
  }

  const ids: string[] = []

  for (const p of entrada.propuestas) {
    const nombre = p.nombre.trim()

    // Si ya existe la MISMA propuesta pendiente —de esta persona o de
    // cualquiera— se reutiliza. Sin esto la cola se llena de cinco
    // «Pintura» que el administrador tiene que resolver una por una, y
    // cada una crearía su propio oficio duplicado al aprobarse.
    const [ya] = await db
      .select({ id: sugerenciasItem.id })
      .from(sugerenciasItem)
      .where(
        and(
          eq(sugerenciasItem.tipo, 'oficio'),
          eq(sugerenciasItem.estado, 'pendiente'),
          eq(sugerenciasItem.grupoSugerido, p.grupo),
          sql`lower(btrim(${sugerenciasItem.nombrePropuesto})) = lower(${nombre})`,
        ),
      )
      .limit(1)

    let sugerenciaId = ya?.id
    if (!sugerenciaId) {
      const [nueva] = await db
        .insert(sugerenciasItem)
        .values({
          tipo: 'oficio',
          nombrePropuesto: nombre,
          grupoSugerido: p.grupo,
          origen: 'proveedor',
          propuestaPor: llave.usuarioId,
        })
        .returning({ id: sugerenciasItem.id })
      sugerenciaId = nueva.id
    }

    ids.push(sugerenciaId)

    await db
      .insert(proveedorOficiosSugeridos)
      .values({
        proveedorId: ficha.id,
        sugerenciaId,
        modo: p.modo,
        precioDesde: p.precio_desde == null ? null : String(p.precio_desde),
        unidad: p.unidad ?? null,
      })
      .onConflictDoUpdate({
        target: [
          proveedorOficiosSugeridos.proveedorId,
          proveedorOficiosSugeridos.sugerenciaId,
        ],
        set: {
          modo: p.modo,
          precioDesde: p.precio_desde == null ? null : String(p.precio_desde),
          unidad: p.unidad ?? null,
        },
      })
  }

  // Lo que ya no está en la lista se quita de la ficha.
  //
  // ⚠ Se borra la fila de ESTA tabla, no la sugerencia. La sugerencia puede
  // estar sosteniendo la solicitud de otra persona, y aunque no sostenga
  // nada, una propuesta que llega a la cola con «usos: 0» es justo la señal
  // que le dice al administrador que puede rechazarla sin romperle nada a
  // nadie.
  const sobran = await db
    .select({ id: proveedorOficiosSugeridos.sugerenciaId })
    .from(proveedorOficiosSugeridos)
    .where(eq(proveedorOficiosSugeridos.proveedorId, ficha.id))

  const fuera = sobran.map((s) => s.id).filter((id) => !ids.includes(id))
  if (fuera.length > 0) {
    await db
      .delete(proveedorOficiosSugeridos)
      .where(
        and(
          eq(proveedorOficiosSugeridos.proveedorId, ficha.id),
          inArray(proveedorOficiosSugeridos.sugerenciaId, fuera),
        ),
      )
  }

  return { ok: true }
}

/**
 * Las subcategorías del catálogo de una categoría. Para el formulario de
 * pedir, que hasta el ADR 0013 no necesitaba el catálogo y ahora sí.
 */
export async function catalogo(db: BaseDeDatos): Promise<Subcategoria[]> {
  const filas = await db
    .select({
      id: catalogoOficios.id,
      nombre: catalogoOficios.nombre,
      grupo: catalogoOficios.grupo,
      riesgo: catalogoOficios.riesgo,
    })
    .from(catalogoOficios)
    .where(eq(catalogoOficios.activo, true))
    .orderBy(catalogoOficios.orden)

  // Los dos son texto con su CHECK en la base, y Drizzle los tipa como
  // cadena suelta. El estrechamiento se hace aquí, en el borde del
  // dominio, para que ni el contrato ni las pantallas lo repitan.
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    grupo: f.grupo as GrupoOficio,
    riesgo: f.riesgo as Subcategoria['riesgo'],
  }))
}
