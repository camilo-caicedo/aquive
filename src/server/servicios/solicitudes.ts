import { and, desc, eq, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { catalogoOficios, solicitudesServicio, sugerenciasItem, zonas } from '@/db/esquema'
import { contienePII, validarNota, validarSugerencia } from '@/lib/validacion'
import type { GrupoOficio, MiSolicitudServicio } from '@/contrato/servicios'

export class SolicitudRechazada extends Error {}

/**
 * Pedir un servicio.
 *
 * ⚠ Esto era `crear_solicitud_servicio`, una función de PL/pgSQL a la que se
 * le pasaba un token en claro para que lo hasheara dentro. Se sube al
 * dominio por el ADR 0001 —la lógica de negocio sale del motor— y porque el
 * ADR 0006 dejó esa función apuntando a una columna que ya no existe.
 *
 * ⚠ Tener cuenta no es dar datos (ADR 0006): su nombre no se publica y la
 * solicitud no lo lleva. Lo que se le pide es categoría, lo que necesita
 * escrito, municipio, zona, urgencia, capacidad de pago y la nota — y nada
 * de eso lo identifica.
 *
 * ⚠ Desde el ADR 0011 el oficio del catálogo NO entra aquí. Entra una de
 * las doce categorías —ocho hasta el ADR 0012— y una línea que escribe
 * quien pide, porque el rebusque es justo el trabajo que no está en
 * ninguna lista.
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
    grupo: GrupoOficio
    /** Del catálogo, o propuesta. Exactamente una (ADR 0013). */
    oficio_id?: string
    subcategoria_nueva?: string
    detalle?: string
    municipio: string
    zona_id?: string
    zona_texto?: string
    urgencia: 'hoy' | 'esta_semana' | 'sin_prisa'
    capacidad_pago: 'puedo_pagar' | 'pago_poco' | 'no_puedo_pagar'
    nota?: string
  },
  llave: { usuarioId: string | null },
): Promise<{ id: string; codigo: string }> {
  if (!llave.usuarioId) {
    throw new SolicitudRechazada('Para pedir un servicio necesitas entrar con tu cuenta.')
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

  // Exactamente una subcategoría. Se repite aquí y no se delega al borde
  // porque el dominio tiene que servir igual desde React Native, donde no
  // pasa por el mismo Zod.
  if (Boolean(entrada.oficio_id) === Boolean(entrada.subcategoria_nueva)) {
    throw new SolicitudRechazada('Elige qué necesitas de la lista, o escríbelo tú.')
  }

  // El oficio tiene que existir, estar activo y ser DE ESA CATEGORÍA. Sin
  // lo último, una llamada a mano puede colgar «Peluquería» de «Arreglos
  // de la casa» y el filtro del tablero deja de significar nada.
  if (entrada.oficio_id) {
    const [oficio] = await db
      .select({ id: catalogoOficios.id })
      .from(catalogoOficios)
      .where(
        and(
          eq(catalogoOficios.id, entrada.oficio_id),
          eq(catalogoOficios.activo, true),
          eq(catalogoOficios.grupo, entrada.grupo),
        ),
      )
      .limit(1)
    if (!oficio) {
      throw new SolicitudRechazada('Eso no está en la lista de esa categoría.')
    }
  }

  // Lo que se escribe a mano lleva el mismo control que el ítem de insumos
  // propuesto: tope de 60 y filtro de PII. Es la tercera puerta por la que
  // entra texto libre a una pantalla pública.
  if (entrada.subcategoria_nueva) {
    const error = validarSugerencia(entrada.subcategoria_nueva)
    if (error) throw new SolicitudRechazada(error)
  }

  // La zona escrita a mano es por donde más fácil se cuela un teléfono:
  // «comuna 3, llámame al…».
  if (entrada.zona_texto && contienePII(entrada.zona_texto)) {
    throw new SolicitudRechazada(
      'No escribas teléfonos, correos ni cédulas. Se acuerda por el chat de aquí.',
    )
  }
  if (entrada.nota) {
    const error = validarNota(entrada.nota)
    if (error) throw new SolicitudRechazada(error)
  }

  // La zona tiene que ser de ese municipio. Sin esto, una comuna de Cali
  // podía quedar colgada de una solicitud de Buga.
  if (entrada.zona_id) {
    const [zona] = await db
      .select({ id: zonas.id })
      .from(zonas)
      .where(and(eq(zonas.id, entrada.zona_id), eq(zonas.municipio, entrada.municipio)))
      .limit(1)
    if (!zona) throw new SolicitudRechazada('Esa zona no es de ese municipio.')
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

    // La propuesta nace aquí, y la solicitud se publica igual (ADR 0011):
    // quien pide necesita respuesta hoy, no cuando alguien mire la cola.
    let sugerenciaId: string | null = null
    if (entrada.subcategoria_nueva) {
      const [sug] = await db
        .insert(sugerenciasItem)
        .values({
          tipo: 'oficio',
          nombrePropuesto: entrada.subcategoria_nueva.trim(),
          grupoSugerido: entrada.grupo,
          origen: 'solicitante',
          propuestaPor: llave.usuarioId,
        })
        .returning({ id: sugerenciasItem.id })
      sugerenciaId = sug.id
    }

    const [fila] = await db
      .insert(solicitudesServicio)
      .values({
        codigo,
        perfilId: llave.usuarioId,
        grupo: entrada.grupo,
        oficioId: entrada.oficio_id ?? null,
        sugerenciaId,
        detalle: entrada.detalle?.trim() ?? null,
        municipio: entrada.municipio,
        zonaId: entrada.zona_id ?? null,
        zonaTexto: entrada.zona_texto ?? null,
        urgencia: entrada.urgencia,
        capacidadPago: entrada.capacidad_pago,
        nota: entrada.nota ?? null,
      })
      .returning({ id: solicitudesServicio.id })

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
      num_respuestas: sql<number>`(
        select count(*)::int from respuestas_servicio r
         where r.solicitud_id = ${solicitudesServicio.id}
      )`,
    })
    .from(solicitudesServicio)
    // ⚠ LEFT, las dos. Un INNER se traga las solicitudes sin oficio —las
    // anteriores al ADR 0013 y las que llevan propuesta— sin dar error.
    .leftJoin(catalogoOficios, eq(catalogoOficios.id, solicitudesServicio.oficioId))
    .leftJoin(sugerenciasItem, eq(sugerenciasItem.id, solicitudesServicio.sugerenciaId))
    .where(eq(solicitudesServicio.perfilId, llave.usuarioId))
    .orderBy(desc(solicitudesServicio.creadaAt))

  return filas.map((f) => ({
    id: f.id,
    codigo: f.codigo,
    grupo: f.grupo as MiSolicitudServicio['grupo'],
    subcategoria: f.oficio_nombre ?? f.propuesta ?? null,
    subcategoria_en_revision: f.oficio_nombre === null && f.propuesta !== null,
    detalle: f.detalle,
    estado: f.estado,
    num_respuestas: Number(f.num_respuestas),
    creada_at: String(f.creada_at),
    expira_at: String(f.expira_at),
  }))
}

/**
 * Renovar o cerrar la propia.
 *
 * ⚠ El `where` lleva SIEMPRE el perfil. Es lo que impide que alguien cierre
 * la solicitud de otro sabiendo su id, y va en la consulta y no en un `if`
 * de arriba: un `if` se puede saltar reordenando el código, un `where` no.
 */
export async function gestionar(
  db: BaseDeDatos,
  id: string,
  accion: 'renovar' | 'cerrar',
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) throw new SolicitudRechazada('Esto no es tuyo.')

  const filas = await db
    .update(solicitudesServicio)
    .set(
      // ⚠ 'resuelta', no 'cerrada'. El CHECK de la tabla solo acepta
      // 'abierta' y 'resuelta', así que cerrar una solicitud reventaba con
      // una violación de restricción en vez de cerrarla.
      accion === 'cerrar'
        ? { estado: 'resuelta' }
        : { expiraAt: sql`now() + interval '15 days'`, estado: 'abierta' },
    )
    .where(
      and(
        eq(solicitudesServicio.id, id),
        eq(solicitudesServicio.perfilId, llave.usuarioId),
      ),
    )
    .returning({ id: solicitudesServicio.id })

  if (filas.length === 0) throw new SolicitudRechazada('Esto no es tuyo.')
  return { ok: true }
}
