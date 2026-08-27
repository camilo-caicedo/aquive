import { and, asc, desc, eq, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import {
  catalogoItems,
  municipios,
  perfiles,
  respuestas,
  solicitudItems,
  solicitudes,
  sugerenciasItem,
} from '@/db/esquema'
import { contienePII, validarNota } from '@/lib/validacion'
import type { MiSolicitudInsumos, SolicitudParaResponder } from '@/contrato/insumos'

export class InsumoRechazado extends Error {}

/**
 * Pedir insumos. El módulo que nació con el sismo del 10 de agosto de 2026.
 *
 * ⚠ Esto era `crear_solicitud`, una función de PL/pgSQL a la que se le
 * pasaba un token en claro. Sube al dominio por el ADR 0001, y hubo que
 * subirlo ya porque el ADR 0006 le quitó la columna sobre la que escribía.
 *
 * ⚠ Lo que se le pide a quien pide NO cambió: municipio, barrio, categoría,
 * los ítems y la nota filtrada. Ni nombre, ni teléfono, ni dirección exacta.
 * Tener cuenta no es dar datos.
 *
 * ⚠ Se retiró `flujo` y `organizacion_id` de la escritura: eran del flujo
 * acompañado, que se va con el ADR 0007. Las columnas siguen en la tabla
 * hasta esa fase; aquí simplemente no se tocan.
 */

/** Cuatro letras y dos dígitos, para decirlo por teléfono sin deletrear. */
function nuevoCodigo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // sin I ni O: se confunden con 1 y 0
  let codigo = ''
  for (let i = 0; i < 4; i++) {
    codigo += letras[Math.floor(Math.random() * letras.length)]
  }
  return codigo + String(Math.floor(Math.random() * 100)).padStart(2, '0')
}

export async function publicar(
  db: BaseDeDatos,
  entrada: {
    municipio: string
    barrio: string
    categoria: string
    nota?: string
    puede_recoger?: boolean
    items: { item_id?: string; sugerencia?: string; cantidad: number }[]
  },
  llave: { usuarioId: string | null },
): Promise<{ id: string; codigo: string }> {
  if (!llave.usuarioId) {
    throw new InsumoRechazado('Para pedir ayuda necesitas entrar con tu cuenta.')
  }

  // Los campos libres, con su filtro (regla de producto 4). El barrio es
  // por donde más fácil se cuela un dato: «El Vergel, casa de la esquina,
  // pregunte por…».
  for (const texto of [entrada.barrio, entrada.nota ?? '']) {
    if (texto && contienePII(texto)) {
      throw new InsumoRechazado(
        'No escribas nombres, teléfonos ni direcciones exactas. Con el barrio basta.',
      )
    }
  }
  if (entrada.nota) {
    const error = validarNota(entrada.nota)
    if (error) throw new InsumoRechazado(error)
  }

  if (entrada.items.length === 0) {
    throw new InsumoRechazado('Elige al menos una cosa de la lista.')
  }
  if (entrada.items.length > 20) {
    throw new InsumoRechazado('Máximo veinte cosas por solicitud.')
  }

  for (let intento = 0; intento < 5; intento++) {
    const codigo = nuevoCodigo()
    const [ya] = await db
      .select({ id: solicitudes.id })
      .from(solicitudes)
      .where(eq(solicitudes.codigo, codigo))
      .limit(1)
    if (ya) continue

    const [fila] = await db
      .insert(solicitudes)
      .values({
        codigo,
        perfilId: llave.usuarioId,
        municipio: entrada.municipio,
        barrio: entrada.barrio,
        categoria: entrada.categoria,
        nota: entrada.nota ?? null,
        puedeRecoger: entrada.puede_recoger ?? false,
      })
      .returning({ id: solicitudes.id })

    for (const item of entrada.items) {
      // Del catálogo o sugerido, nunca los dos: lo mismo que sostiene el
      // `check` de `solicitud_items`.
      if (item.item_id) {
        const [existe] = await db
          .select({ id: catalogoItems.id })
          .from(catalogoItems)
          .where(and(eq(catalogoItems.id, item.item_id), eq(catalogoItems.activo, true)))
          .limit(1)
        if (!existe) continue

        await db.insert(solicitudItems).values({
          solicitudId: fila.id,
          itemId: item.item_id,
          cantidad: String(item.cantidad),
        })
      } else if (item.sugerencia) {
        if (contienePII(item.sugerencia)) {
          throw new InsumoRechazado(
            'Lo que escribas ahí lo va a leer un desconocido: no pongas datos tuyos.',
          )
        }
        const [sug] = await db
          .insert(sugerenciasItem)
          // `origen` dice de dónde vino la propuesta: la revisa un admin
          // antes de que entre al catálogo.
          .values({ nombrePropuesto: item.sugerencia, origen: 'solicitud' })
          .returning({ id: sugerenciasItem.id })

        await db.insert(solicitudItems).values({
          solicitudId: fila.id,
          sugerenciaId: sug.id,
          cantidad: String(item.cantidad),
        })
      }
    }

    return { id: fila.id, codigo }
  }

  throw new InsumoRechazado('No se pudo generar el código. Inténtalo otra vez.')
}

/** Las mías, para el perfil. */
export async function mias(
  db: BaseDeDatos,
  llave: { usuarioId: string | null },
): Promise<MiSolicitudInsumos[]> {
  if (!llave.usuarioId) return []

  const filas = await db
    .select({
      id: solicitudes.id,
      codigo: solicitudes.codigo,
      barrio: solicitudes.barrio,
      categoria: solicitudes.categoria,
      estado: solicitudes.estado,
      creada_at: solicitudes.creadaAt,
      expira_at: solicitudes.expiraAt,
    })
    .from(solicitudes)
    .where(eq(solicitudes.perfilId, llave.usuarioId))
    .orderBy(desc(solicitudes.creadaAt))

  return filas.map((f) => ({
    id: f.id,
    codigo: f.codigo,
    barrio: f.barrio,
    categoria: f.categoria,
    estado: f.estado,
    creada_at: String(f.creada_at),
    expira_at: String(f.expira_at),
  }))
}

/**
 * Renovar por otras 72 horas, o cerrar.
 *
 * ⚠ El `where` lleva SIEMPRE el perfil: es lo que impide cerrar la
 * solicitud de otro sabiendo su id, y va en la consulta y no en un `if`.
 */
export async function gestionar(
  db: BaseDeDatos,
  id: string,
  accion: 'renovar' | 'cerrar',
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) throw new InsumoRechazado('Esto no es tuyo.')

  const filas = await db
    .update(solicitudes)
    .set(
      // ⚠ 'cumplida', no 'cerrada'. El CHECK de la tabla nunca aceptó
      // 'cerrada': cerrar una solicitud reventaba con una violación de
      // restricción. Es el mismo fallo que ya se arregló en el gemelo de
      // servicios; esta copia se quedó rota, y no se notaba porque ninguna
      // pantalla llamaba a esta función.
      accion === 'cerrar'
        ? { estado: 'cumplida' }
        : {
            expiraAt: sql`now() + interval '72 hours'`,
            confirmadaAt: sql`now()`,
            estado: 'abierta',
          },
    )
    .where(and(eq(solicitudes.id, id), eq(solicitudes.perfilId, llave.usuarioId)))
    .returning({ id: solicitudes.id })

  if (filas.length === 0) throw new InsumoRechazado('Esto no es tuyo.')
  return { ok: true }
}

/**
 * Una solicitud por su código, para quien va a responderla.
 *
 * ⚠ De aquí NO sale ni un dato de quien pidió. Ni nombre, ni teléfono, ni
 * dirección: solo el municipio y el barrio, que es la granularidad máxima
 * que la regla de producto 10 permite para quien pide. Lo que devuelve es
 * lo mismo que ya está impreso en el tablero público.
 */
export async function porCodigo(
  db: BaseDeDatos,
  codigo: string,
  llave: { usuarioId: string | null },
): Promise<SolicitudParaResponder | null> {
  const [s] = await db
    .select({
      id: solicitudes.id,
      codigo: solicitudes.codigo,
      municipio: solicitudes.municipio,
      municipioNombre: municipios.nombre,
      barrio: solicitudes.barrio,
      categoria: solicitudes.categoria,
      nota: solicitudes.nota,
      puedeRecoger: solicitudes.puedeRecoger,
      creadaAt: solicitudes.creadaAt,
      expiraAt: solicitudes.expiraAt,
      estado: solicitudes.estado,
    })
    .from(solicitudes)
    .leftJoin(municipios, eq(municipios.codigoDane, solicitudes.municipio))
    .where(eq(solicitudes.codigo, codigo.trim().toUpperCase()))
    .limit(1)

  // Vencida o ya cumplida se trata como inexistente: enseñar una solicitud
  // que no se puede responder es ofrecer un botón que no va a funcionar.
  if (!s || s.estado !== 'abierta' || new Date(s.expiraAt) <= new Date()) return null

  const filas = await db
    .select({
      nombre: sql<string>`coalesce(${catalogoItems.nombre}, ${sugerenciasItem.nombrePropuesto})`,
      cantidad: solicitudItems.cantidad,
      unidad: sql<string>`coalesce(${catalogoItems.unidad}, ${sugerenciasItem.unidadSugerida}, 'unidad')`,
      orden: sql<number>`coalesce(${catalogoItems.orden}, 9999)`,
    })
    .from(solicitudItems)
    .leftJoin(catalogoItems, eq(catalogoItems.id, solicitudItems.itemId))
    .leftJoin(sugerenciasItem, eq(sugerenciasItem.id, solicitudItems.sugerenciaId))
    .where(eq(solicitudItems.solicitudId, s.id))
    .orderBy(asc(sql`coalesce(${catalogoItems.orden}, 9999)`))

  const yaRespondi = llave.usuarioId
    ? (
        await db
          .select({ id: respuestas.id })
          .from(respuestas)
          .where(
            and(eq(respuestas.solicitudId, s.id), eq(respuestas.autorId, llave.usuarioId)),
          )
          .limit(1)
      ).length > 0
    : false

  return {
    id: s.id,
    codigo: s.codigo,
    municipio: s.municipio,
    municipio_nombre: s.municipioNombre,
    barrio: s.barrio,
    categoria: s.categoria,
    nota: s.nota,
    puede_recoger: s.puedeRecoger,
    creada_at: String(s.creadaAt),
    expira_at: String(s.expiraAt),
    items: filas.map((f) => ({
      nombre: f.nombre,
      cantidad: Number(f.cantidad),
      unidad: f.unidad,
    })),
    ya_respondi: yaRespondi,
  }
}

/**
 * «Yo puedo ayudar».
 *
 * ⚠ Esto era la RPC `responder_solicitud`. Sube al dominio por el ADR 0001
 * y porque el Route Handler que la envolvía —`/api/respuestas`— existía solo
 * para avisar por push después de insertar, y ese aviso llevaba a una ruta
 * por token que el ADR 0006 borró.
 *
 * Las comprobaciones son las mismas que hacía la función de Postgres, en el
 * mismo orden, y una de ellas importa más de lo que parece: **sin contacto
 * público no se puede responder**. Todo el flujo directo se sostiene sobre
 * que quien pidió pueda escribirle a quien ofreció; una respuesta sin
 * teléfono es una promesa que el otro lado no puede recoger.
 */
export async function responder(
  db: BaseDeDatos,
  entrada: { codigo: string; mensaje: string; puede_llevar?: boolean },
  llave: { usuarioId: string | null },
): Promise<{ solicitud_id: string }> {
  if (!llave.usuarioId) {
    throw new InsumoRechazado('Para responder necesitas entrar con tu cuenta.')
  }

  const mensaje = entrada.mensaje.trim()
  // El mismo filtro que la nota y el chat (regla de producto 4). Aquí es
  // donde más tienta escribir el teléfono, porque es literalmente lo que se
  // quiere dar — y por eso el perfil ya lo publica y el mensaje no lo lleva.
  const error = validarNota(mensaje)
  if (error) throw new InsumoRechazado(error)

  const [perfil] = await db
    .select({
      id: perfiles.id,
      suspendido: perfiles.suspendido,
      contacto: perfiles.contactoPublico,
    })
    .from(perfiles)
    .where(eq(perfiles.id, llave.usuarioId))
    .limit(1)

  if (!perfil) throw new InsumoRechazado('Necesitas completar tu perfil antes de responder.')
  if (perfil.suspendido) throw new InsumoRechazado('Tu cuenta está suspendida.')
  if (!perfil.contacto) {
    throw new InsumoRechazado(
      'Para responder necesitas un teléfono público en tu perfil: si no, quien pidió no tiene a dónde escribirte.',
    )
  }

  const [s] = await db
    .select({ id: solicitudes.id, estado: solicitudes.estado, expiraAt: solicitudes.expiraAt })
    .from(solicitudes)
    .where(eq(solicitudes.codigo, entrada.codigo.trim().toUpperCase()))
    .limit(1)

  if (!s || s.estado !== 'abierta' || new Date(s.expiraAt) <= new Date()) {
    throw new InsumoRechazado('Esa solicitud ya no está disponible.')
  }

  // Una por persona y solicitud. Lo garantiza además un `unique` en la
  // tabla; esto solo está para poder decirlo con palabras.
  const [ya] = await db
    .select({ id: respuestas.id })
    .from(respuestas)
    .where(and(eq(respuestas.solicitudId, s.id), eq(respuestas.autorId, llave.usuarioId)))
    .limit(1)
  if (ya) throw new InsumoRechazado('Ya respondiste esta solicitud.')

  await db.insert(respuestas).values({
    solicitudId: s.id,
    autorId: llave.usuarioId,
    mensaje,
    puedeLlevar: entrada.puede_llevar === true,
  })

  return { solicitud_id: s.id }
}
