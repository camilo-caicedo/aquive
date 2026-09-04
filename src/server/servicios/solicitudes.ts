import { and, desc, eq, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import {
  catalogoOficios,
  chats,
  proveedorOficiosPublicos,
  proveedores,
  solicitudesServicio,
  sugerenciasItem,
} from '@/db/esquema'
import { contienePII, validarNota } from '@/lib/validacion'
import type { MiSolicitudServicio, OrdenProveedor } from '@/contrato/servicios'
import { transicionValida, type EstadoSolicitud } from './transiciones'

export class SolicitudRechazada extends Error {}

/**
 * Pedir un servicio.
 *
 * ⚠ ADR 0015: deja de ser un pedido al aire. Nace dirigida a un
 * `proveedor_id` concreto — la ficha desde la que se abrió el formulario —
 * y el municipio y la zona los copia de esa ficha: son un hecho real (dónde
 * está el prestador), no una pregunta más que hacerle a quien pide.
 *
 * ⚠ El `oficio_id` tiene que ser uno de los que ESTA ficha ya ofrece —se
 * comprueba contra `proveedor_oficios_publicos`, no contra el catálogo
 * entero—, y de ahí sale también el `grupo`: quien pide no elige una
 * categoría, porque el oficio ya dice de cuál es. Sin paso de «¿no
 * encuentras lo tuyo?»: esa salida del ADR 0013 tenía sentido contra 81
 * oficios, no contra los tres o cuatro que un prestador concreto declaró.
 *
 * ⚠ El hilo nace en la misma operación (ADR 0015): la orden ya identifica a
 * los dos lados desde que se publica, así que no hay razón para esperar a
 * que alguien abra el chat para crearlo.
 *
 * ⚠ Tener cuenta no es dar datos (ADR 0006): su nombre no se publica y la
 * solicitud no lo lleva.
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
    proveedor_id: string
    /** Uno de los oficios que ESTA ficha ya ofrece (regla de producto 1 del encargo). */
    oficio_id: string
    detalle?: string
    nota?: string
  },
  llave: { usuarioId: string | null },
): Promise<{ id: string; codigo: string }> {
  if (!llave.usuarioId) {
    throw new SolicitudRechazada('Para pedir un servicio necesitas entrar con tu cuenta.')
  }

  // La ficha tiene que existir y seguir publicada: es de donde se copian
  // municipio y zona, y pedirle algo a una ficha suspendida no tiene
  // destinatario de verdad.
  const [proveedor] = await db
    .select({
      id: proveedores.id,
      municipio: proveedores.municipio,
      zonaId: proveedores.zonaId,
      zonaTexto: proveedores.zonaTexto,
      suspendido: proveedores.suspendido,
    })
    .from(proveedores)
    .where(eq(proveedores.id, entrada.proveedor_id))
    .limit(1)
  if (!proveedor || proveedor.suspendido) {
    throw new SolicitudRechazada('Esa ficha ya no está disponible.')
  }

  // El oficio tiene que ser uno de los que ESTA ficha de verdad ofrece —no
  // cualquiera del catálogo—. `proveedor_oficios_publicos` ya aplica la
  // regla de producto 7 (riesgo alto escondido sin respaldo), así que un
  // oficio escondido tampoco se puede pedir por aquí. De aquí sale también
  // el `grupo`: quien pide no elige categoría, el oficio ya dice cuál es.
  const [oficio] = await db
    .select({ grupo: proveedorOficiosPublicos.grupo })
    .from(proveedorOficiosPublicos)
    .where(
      and(
        eq(proveedorOficiosPublicos.proveedorId, proveedor.id),
        eq(proveedorOficiosPublicos.oficioId, entrada.oficio_id),
      ),
    )
    .limit(1)
  if (!oficio) {
    throw new SolicitudRechazada('Ese prestador no ofrece ese oficio.')
  }

  // Los campos libres, con su filtro (regla de producto 4). Si por ahí se
  // cuela un teléfono, el chat deja de tener sentido antes de empezar.
  //
  // ⚠ El detalle es opcional desde el ADR 0013, así que solo se valida
  // con algo escrito: llamar a `validarNota('')` no falla, pero validar
  // lo que la persona no escribió es cómo aparecen mensajes de error sobre
  // campos vacíos.
  if (entrada.detalle) {
    const errorDetalle = validarNota(entrada.detalle)
    if (errorDetalle) throw new SolicitudRechazada(errorDetalle)
  }

  if (entrada.nota) {
    const error = validarNota(entrada.nota)
    if (error) throw new SolicitudRechazada(error)
  }
  if (entrada.nota && contienePII(entrada.nota)) {
    throw new SolicitudRechazada(
      'No escribas teléfonos, correos ni cédulas. Se acuerda por el chat de aquí.',
    )
  }

  // El código se dice por teléfono, así que tiene que ser único. Se
  // reintenta un puñado de veces en vez de una sola: con 24^4 · 100 el
  // choque es rarísimo, pero «rarísimo» no es «nunca».
  for (let intento = 0; intento < 5; intento++) {
    const codigo = nuevoCodigo()
    const [ya] = await db
      .select({ id: solicitudesServicio.id })
      .from(solicitudesServicio)
      .where(eq(solicitudesServicio.codigo, codigo))
      .limit(1)
    if (ya) continue

    const [fila] = await db
      .insert(solicitudesServicio)
      .values({
        codigo,
        perfilId: llave.usuarioId,
        proveedorId: proveedor.id,
        // La vista siempre trae grupo — viene de un `join` obligatorio con
        // `catalogo_oficios`—; el tipo lo marca nulo porque es una vista.
        grupo: oficio.grupo!,
        oficioId: entrada.oficio_id,
        detalle: entrada.detalle?.trim() ?? null,
        // Copiados de la ficha (ADR 0015): describen dónde está el
        // prestador, un hecho real, no una pregunta más para quien pide.
        municipio: proveedor.municipio,
        zonaId: proveedor.zonaId,
        zonaTexto: proveedor.zonaTexto,
        nota: entrada.nota ?? null,
      })
      .returning({ id: solicitudesServicio.id })

    // El hilo nace aquí mismo (ADR 0015): la orden ya identifica a los dos
    // lados, así que no hay razón para esperar a que alguien abra el chat.
    await db.insert(chats).values({ solicitudServicioId: fila.id })

    return { id: fila.id, codigo }
  }

  throw new SolicitudRechazada('No se pudo generar el código. Inténtalo otra vez.')
}

/** Las mías, para el perfil. Sustituye a la lista de `localStorage`. */
export async function mias(
  db: BaseDeDatos,
  llave: { usuarioId: string | null },
): Promise<MiSolicitudServicio[]> {
  if (!llave.usuarioId) return []

  const filas = await db
    .select({
      id: solicitudesServicio.id,
      codigo: solicitudesServicio.codigo,
      grupo: solicitudesServicio.grupo,
      // La subcategoría por sus dos caminos: el oficio del catálogo, o el
      // texto propuesto mientras nadie lo ha mirado. Uno de los dos, nunca
      // los dos, y en las anteriores al ADR 0013 ninguno.
      oficio_nombre: catalogoOficios.nombre,
      propuesta: sugerenciasItem.nombrePropuesto,
      detalle: solicitudesServicio.detalle,
      estado: solicitudesServicio.estado,
      creada_at: solicitudesServicio.creadaAt,
      expira_at: solicitudesServicio.expiraAt,
      proveedor_id: solicitudesServicio.proveedorId,
      proveedor_nombre: proveedores.nombreVisible,
    })
    .from(solicitudesServicio)
    // ⚠ LEFT, las tres. Un INNER en oficio/sugerencia se traga las
    // solicitudes sin oficio —las anteriores al ADR 0013 y las que llevan
    // propuesta— sin dar error; y el proveedor puede haber borrado su
    // ficha si esto llegó a existir antes de la cascada.
    .leftJoin(catalogoOficios, eq(catalogoOficios.id, solicitudesServicio.oficioId))
    .leftJoin(sugerenciasItem, eq(sugerenciasItem.id, solicitudesServicio.sugerenciaId))
    .leftJoin(proveedores, eq(proveedores.id, solicitudesServicio.proveedorId))
    .where(eq(solicitudesServicio.perfilId, llave.usuarioId))
    .orderBy(desc(solicitudesServicio.creadaAt))

  return filas.map((f) => ({
    id: f.id,
    codigo: f.codigo,
    grupo: f.grupo as MiSolicitudServicio['grupo'],
    subcategoria: f.oficio_nombre ?? f.propuesta ?? null,
    subcategoria_en_revision: f.oficio_nombre === null && f.propuesta !== null,
    detalle: f.detalle,
    estado: f.estado as MiSolicitudServicio['estado'],
    creada_at: String(f.creada_at),
    expira_at: String(f.expira_at),
    proveedor_id: f.proveedor_id,
    proveedor_nombre: f.proveedor_nombre,
  }))
}

/**
 * Renovar o cancelar la propia. Quien pide, no el prestador.
 *
 * ⚠ El `where` lleva SIEMPRE el perfil. Es lo que impide que alguien toque
 * la solicitud de otro sabiendo su id, y va en la consulta y no en un `if`
 * de arriba: un `if` se puede saltar reordenando el código, un `where` no.
 *
 * ⚠ No hay un sexto estado «cancelada»: el cliente pidió cinco (ADR 0015).
 * Cancelar aterriza en `no_concretada`, que es la que el ADR describe como
 * «cierra sin que el trabajo se haya hecho, sin necesidad de decir de quién
 * fue la culpa» — justo lo que es cancelar la propia. `rechazada` habría
 * sido atribuirle al prestador una decisión que no tomó él.
 */
export async function gestionar(
  db: BaseDeDatos,
  id: string,
  accion: 'renovar' | 'cancelar',
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) throw new SolicitudRechazada('Esto no es tuyo.')

  const [actual] = await db
    .select({ estado: solicitudesServicio.estado })
    .from(solicitudesServicio)
    .where(
      and(
        eq(solicitudesServicio.id, id),
        eq(solicitudesServicio.perfilId, llave.usuarioId),
      ),
    )
    .limit(1)
  if (!actual) throw new SolicitudRechazada('Esto no es tuyo.')

  if (accion === 'renovar') {
    // Solo tiene sentido mientras nadie ha contestado: una orden aceptada
    // no vence sola (ADR 0015), así que «renovar» algo que no está
    // pendiente no significa nada.
    if (actual.estado !== 'pendiente') {
      throw new SolicitudRechazada('Ya no se puede renovar: el prestador ya respondió.')
    }
    await db
      .update(solicitudesServicio)
      .set({ expiraAt: sql`now() + interval '15 days'` })
      .where(eq(solicitudesServicio.id, id))
    return { ok: true }
  }

  // Cancelar: solo mientras todavía hay algo que detener.
  if (actual.estado !== 'pendiente' && actual.estado !== 'aceptada') {
    throw new SolicitudRechazada('Esta orden ya está cerrada.')
  }
  await db
    .update(solicitudesServicio)
    .set({ estado: 'no_concretada' satisfies EstadoSolicitud })
    .where(eq(solicitudesServicio.id, id))
  return { ok: true }
}

/**
 * La bandeja del prestador: sus órdenes, para aceptar, rechazar o cerrar.
 *
 * Sin ficha propia, lista vacía — igual que `mias()` sin cuenta.
 */
export async function misOrdenes(
  db: BaseDeDatos,
  llave: { usuarioId: string | null },
): Promise<OrdenProveedor[]> {
  if (!llave.usuarioId) return []

  const [ficha] = await db
    .select({ id: proveedores.id })
    .from(proveedores)
    .where(eq(proveedores.perfilId, llave.usuarioId))
    .limit(1)
  if (!ficha) return []

  const filas = await db
    .select({
      id: solicitudesServicio.id,
      codigo: solicitudesServicio.codigo,
      grupo: solicitudesServicio.grupo,
      oficio_nombre: catalogoOficios.nombre,
      propuesta: sugerenciasItem.nombrePropuesto,
      detalle: solicitudesServicio.detalle,
      nota: solicitudesServicio.nota,
      estado: solicitudesServicio.estado,
      creada_at: solicitudesServicio.creadaAt,
    })
    .from(solicitudesServicio)
    .leftJoin(catalogoOficios, eq(catalogoOficios.id, solicitudesServicio.oficioId))
    .leftJoin(sugerenciasItem, eq(sugerenciasItem.id, solicitudesServicio.sugerenciaId))
    .where(eq(solicitudesServicio.proveedorId, ficha.id))
    // Lo accionable primero: pendiente antes que aceptada, y las tres
    // terminales al final. Dentro de cada grupo, lo más nuevo arriba.
    .orderBy(
      sql`case ${solicitudesServicio.estado}
            when 'pendiente' then 0
            when 'aceptada' then 1
            else 2
          end`,
      desc(solicitudesServicio.creadaAt),
    )

  return filas.map((f) => ({
    id: f.id,
    codigo: f.codigo,
    grupo: f.grupo as OrdenProveedor['grupo'],
    subcategoria: f.oficio_nombre ?? f.propuesta ?? null,
    subcategoria_en_revision: f.oficio_nombre === null && f.propuesta !== null,
    detalle: f.detalle,
    nota: f.nota,
    estado: f.estado as OrdenProveedor['estado'],
    creada_at: String(f.creada_at),
  }))
}

/**
 * El prestador acepta, rechaza o cierra una orden suya.
 *
 * ⚠ La verificación de dueño va por SQL —`proveedores.perfilId =
 * usuarioId`—, no por confiar en que la interfaz solo le enseñe el botón a
 * quien toca: un `id` de solicitud cualquiera no basta si esa ficha no es
 * de quien llama.
 */
export async function cambiarEstado(
  db: BaseDeDatos,
  id: string,
  siguiente: EstadoSolicitud,
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) throw new SolicitudRechazada('Esto no es tuyo.')

  const [fila] = await db
    .select({ estado: solicitudesServicio.estado })
    .from(solicitudesServicio)
    .innerJoin(proveedores, eq(proveedores.id, solicitudesServicio.proveedorId))
    .where(
      and(
        eq(solicitudesServicio.id, id),
        eq(proveedores.perfilId, llave.usuarioId),
      ),
    )
    .limit(1)
  if (!fila) throw new SolicitudRechazada('Esto no es tuyo.')

  if (!transicionValida(fila.estado, siguiente)) {
    throw new SolicitudRechazada(`No se puede pasar de "${fila.estado}" a "${siguiente}".`)
  }

  await db
    .update(solicitudesServicio)
    .set({ estado: siguiente })
    .where(eq(solicitudesServicio.id, id))
  return { ok: true }
}
