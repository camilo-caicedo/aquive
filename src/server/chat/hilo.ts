import { and, asc, eq, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import {
  chats,
  mensajes as mensajesTabla,
  productos,
  proveedores,
  publicacionesMuro,
  respuestas,
  respuestasServicio,
  solicitudes,
  solicitudesServicio,
} from '@/db/esquema'
import { MENSAJE_CONTACTO, contieneContacto } from '@/lib/validacion'
import type { Autor, Hilo, HiloEnBandeja, Mensaje, Origen } from '@/contrato/chat'

// El chat, uno solo. Capa de dominio: sin `next/*`, sin cookies.
//
// Un hilo tiene siempre dos lados —quien ofrece y quien pide— y lo único que
// cambia entre los cinco orígenes es de dónde salen esos dos lados. Eso vive
// en `partes()`, que es la única función que sabe que existen módulos. Todo
// lo demás —el filtro, los mensajes, la bandeja— es común.

/**
 * Los dos lados de un hilo.
 *
 * Un lado en `null` significa «lo ocupa quien abra el hilo». Pasa cuando el
 * origen solo identifica a uno: una ficha dice quién trabaja pero no quién lo
 * necesita, un producto dice quién vende pero no quién pregunta, y una
 * publicación del muro dice quién dona pero no quién recibe. Una respuesta
 * —de servicio o de insumo— ya identifica a los dos.
 */
type Partes = {
  ofrece: string | null
  pide: string | null
  asunto: string | null
  nombreOfrece: string | null
  nombrePide: string | null
}

/** Cómo se llama el otro cuando no publicó su nombre. */
const ANONIMO: Record<Origen['tipo'], { ofrece: string; pide: string }> = {
  servicio: { ofrece: 'El prestador', pide: 'Quien pidió el servicio' },
  insumo: { ofrece: 'Quien puede ayudar', pide: 'Quien pidió el insumo' },
  producto: { ofrece: 'Quien vende', pide: 'Quien preguntó' },
  muro: { ofrece: 'Quien lo ofrece', pide: 'Quien lo necesita' },
  ficha: { ofrece: 'El prestador', pide: 'Quien preguntó' },
}

/** De dónde salen los dos lados. La única función que distingue módulos. */
async function partes(db: BaseDeDatos, origen: Origen): Promise<Partes | null> {
  if (origen.tipo === 'servicio') {
    const [f] = await db
      .select({
        ofrece: proveedores.perfilId,
        pide: solicitudesServicio.perfilId,
        // Lo que pidió con sus palabras, no el nombre de un oficio del
        // catálogo (ADR 0011). El asunto del hilo es de qué se está
        // hablando, y «Que me arreglen la puerta del clóset» lo dice mejor
        // que «Reparaciones del hogar».
        asunto: solicitudesServicio.detalle,
        nombreOfrece: proveedores.nombreVisible,
      })
      .from(respuestasServicio)
      .innerJoin(
        solicitudesServicio,
        eq(solicitudesServicio.id, respuestasServicio.solicitudId),
      )
      .innerJoin(proveedores, eq(proveedores.id, respuestasServicio.proveedorId))
      .where(eq(respuestasServicio.id, origen.id))
      .limit(1)
    // Quien pide un servicio no publica su nombre, y no se le inventa uno.
    return f ? { ...f, nombrePide: null } : null
  }

  if (origen.tipo === 'insumo') {
    const [f] = await db
      .select({
        ofrece: respuestas.autorId,
        pide: solicitudes.perfilId,
        asunto: solicitudes.categoria,
      })
      .from(respuestas)
      .innerJoin(solicitudes, eq(solicitudes.id, respuestas.solicitudId))
      .where(eq(respuestas.id, origen.id))
      .limit(1)
    // En insumos nadie publica nombre: ni quien pide ni quien responde.
    return f ? { ...f, nombreOfrece: null, nombrePide: null } : null
  }

  if (origen.tipo === 'ficha') {
    const [f] = await db
      .select({ ofrece: proveedores.perfilId, nombreOfrece: proveedores.nombreVisible })
      .from(proveedores)
      .where(eq(proveedores.id, origen.id))
      .limit(1)
    // Sin asunto: el hilo es con la persona, y su nombre ya va en `con`.
    return f ? { ...f, pide: null, asunto: null, nombrePide: null } : null
  }

  if (origen.tipo === 'producto') {
    const [f] = await db
      .select({
        ofrece: proveedores.perfilId,
        asunto: productos.nombre,
        nombreOfrece: proveedores.nombreVisible,
      })
      .from(productos)
      .innerJoin(proveedores, eq(proveedores.id, productos.proveedorId))
      .where(eq(productos.id, origen.id))
      .limit(1)
    return f ? { ...f, pide: null, nombrePide: null } : null
  }

  const [f] = await db
    .select({
      cara: publicacionesMuro.cara,
      perfil: publicacionesMuro.perfilId,
      asunto: publicacionesMuro.titulo,
      nombre: publicacionesMuro.autorNombre,
    })
    .from(publicacionesMuro)
    .where(eq(publicacionesMuro.id, origen.id))
    .limit(1)

  if (!f) return null

  // Las dos caras del muro son el mismo hilo al revés: en «ofrece» el dueño
  // tiene la cosa, en «necesita» la necesita. Solo la primera lleva nombre
  // publicado, que es lo que exige el `check` de la tabla.
  return f.cara === 'ofrece'
    ? {
        ofrece: f.perfil,
        pide: null,
        asunto: f.asunto,
        nombreOfrece: f.nombre,
        nombrePide: null,
      }
    : {
        ofrece: null,
        pide: f.perfil,
        asunto: f.asunto,
        nombreOfrece: null,
        nombrePide: f.nombre,
      }
}

/**
 * Qué papel juega quien llega, decidido por de qué es dueño y no por lo que
 * dice. Si un lado está abierto lo ocupa quien no sea el otro, y por eso los
 * dos lados conocidos se comprueban primero: nadie es sus dos lados.
 */
function papel(p: Partes, usuarioId: string | null): Autor | null {
  if (!usuarioId) return null
  if (p.ofrece === usuarioId) return 'ofrece'
  if (p.pide === usuarioId) return 'pide'
  if (p.ofrece === null) return 'ofrece'
  if (p.pide === null) return 'pide'
  return null
}

/** Dónde vive la fila del hilo, según de qué cuelgue. */
function donde(origen: Origen, iniciadoPor: string | null): SQL {
  switch (origen.tipo) {
    case 'servicio':
      return eq(chats.respuestaServicioId, origen.id)
    case 'insumo':
      return eq(chats.respuestaInsumoId, origen.id)
    case 'producto':
      return and(eq(chats.productoId, origen.id), eq(chats.iniciadoPor, iniciadoPor!)) as SQL
    case 'muro':
      return and(eq(chats.publicacionId, origen.id), eq(chats.iniciadoPor, iniciadoPor!)) as SQL
    case 'ficha':
      return and(eq(chats.proveedorId, origen.id), eq(chats.iniciadoPor, iniciadoPor!)) as SQL
  }
}

function valores(origen: Origen, iniciadoPor: string | null) {
  switch (origen.tipo) {
    case 'servicio':
      return { respuestaServicioId: origen.id }
    case 'insumo':
      return { respuestaInsumoId: origen.id }
    case 'producto':
      return { productoId: origen.id, iniciadoPor }
    case 'muro':
      return { publicacionId: origen.id, iniciadoPor }
    case 'ficha':
      return { proveedorId: origen.id, iniciadoPor }
  }
}

/**
 * Quién ocupa el lado abierto. `null` cuando el origen ya identifica a los
 * dos, que es lo que el `check` de la base espera en esas dos columnas.
 */
function iniciador(p: Partes, usuarioId: string): string | null {
  return p.ofrece === null || p.pide === null ? usuarioId : null
}

/** El hilo, creándolo si es la primera vez que alguien entra. */
export async function leer(
  db: BaseDeDatos,
  origen: Origen,
  llave: { usuarioId: string | null },
): Promise<Hilo | null> {
  const p = await partes(db, origen)
  if (!p || !llave.usuarioId) return null

  const autor = papel(p, llave.usuarioId)
  if (!autor) return null

  const iniciadoPor = iniciador(p, llave.usuarioId)
  const seleccion = { id: chats.id, cerradoAt: chats.cerradoAt }

  // El hilo se crea al abrirlo y no al publicar: un producto que nadie
  // pregunta no tiene por qué dejar una fila vacía en la base.
  let [chat] = await db
    .select(seleccion)
    .from(chats)
    .where(donde(origen, iniciadoPor))
    .limit(1)

  if (!chat) {
    const [creado] = await db
      .insert(chats)
      .values(valores(origen, iniciadoPor))
      .onConflictDoNothing()
      .returning(seleccion)
    chat =
      creado ??
      (
        await db
          .select(seleccion)
          .from(chats)
          .where(donde(origen, iniciadoPor))
          .limit(1)
      )[0]
  }

  const filas = await db
    .select({
      id: mensajesTabla.id,
      autor: mensajesTabla.autor,
      cuerpo: mensajesTabla.cuerpo,
      creado_at: mensajesTabla.creadoAt,
    })
    .from(mensajesTabla)
    .where(and(eq(mensajesTabla.chatId, chat.id), eq(mensajesTabla.oculto, false)))
    .orderBy(asc(mensajesTabla.creadoAt))

  // Queda mirado, para el contador del menú. Va después de leer los
  // mensajes y no antes: si fallara la lectura, el hilo seguiría contando
  // como sin leer, que es el error que no pierde nada.
  await db
    .update(chats)
    .set(
      autor === 'ofrece'
        ? { vistoOfreceAt: sql`now()` }
        : { vistoPideAt: sql`now()` },
    )
    .where(eq(chats.id, chat.id))

  const anonimo = ANONIMO[origen.tipo]

  return {
    id: chat.id,
    origen,
    cerrado: chat.cerradoAt !== null,
    con:
      autor === 'pide'
        ? (p.nombreOfrece ?? anonimo.ofrece)
        : (p.nombrePide ?? anonimo.pide),
    soy: autor,
    asunto: p.asunto,
    mensajes: filas.map((m) => ({
      id: m.id,
      autor: m.autor as Autor,
      cuerpo: m.cuerpo,
      creado_at: String(m.creado_at),
    })),
  }
}

export class ChatRechazado extends Error {}

/**
 * Escribir en el hilo.
 *
 * El filtro de datos de contacto va aquí, en el servidor, y rechaza el
 * envío. Sin él el chat es solo una manera más lenta de pedir el número por
 * fuera, y entonces no protege a nadie de nada — que es justo lo que este
 * chat existe para hacer.
 */
export async function escribir(
  db: BaseDeDatos,
  entrada: { origen: Origen; cuerpo: string },
  llave: { usuarioId: string | null },
): Promise<{ mensaje: Mensaje }> {
  const p = await partes(db, entrada.origen)
  const autor = p ? papel(p, llave.usuarioId) : null
  if (!p || !autor || !llave.usuarioId) {
    throw new ChatRechazado('No puedes escribir en este hilo.')
  }

  const cuerpo = entrada.cuerpo.trim()
  if (contieneContacto(cuerpo)) throw new ChatRechazado(MENSAJE_CONTACTO)

  const [chat] = await db
    .select({ id: chats.id, cerradoAt: chats.cerradoAt })
    .from(chats)
    .where(donde(entrada.origen, iniciador(p, llave.usuarioId)))
    .limit(1)

  if (!chat) throw new ChatRechazado('El hilo todavía no está abierto.')
  if (chat.cerradoAt !== null) throw new ChatRechazado('Este hilo ya se cerró.')

  const [creado] = await db
    .insert(mensajesTabla)
    .values({ chatId: chat.id, autor, cuerpo })
    .returning({
      id: mensajesTabla.id,
      autor: mensajesTabla.autor,
      cuerpo: mensajesTabla.cuerpo,
      creado_at: mensajesTabla.creadoAt,
    })

  return {
    mensaje: {
      id: creado.id,
      autor: creado.autor as Autor,
      cuerpo: creado.cuerpo,
      creado_at: String(creado.creado_at),
    },
  }
}

type FilaBandeja = {
  tipo: Origen['tipo']
  origen_id: string
  ofrece_id: string | null
  pide_id: string | null
  asunto: string | null
  nombre_ofrece: string | null
  nombre_pide: string | null
  ultimo: string | null
  ultimo_at: string | null
  mensajes: number
  sin_leer: boolean
}

/**
 * El SQL que aplana los cinco orígenes a una sola forma de fila.
 *
 * Lo usan la bandeja y el contador del menú, y por eso está aquí fuera: dos
 * copias de estos `join` se separarían el día que aparezca un sexto origen,
 * y entonces el menú contaría hilos que la bandeja no enseña.
 */
const HILOS = sql`
  select
    c.id,
    case
      when c.respuesta_servicio_id is not null then 'servicio'
      when c.respuesta_insumo_id is not null then 'insumo'
      when c.producto_id is not null then 'producto'
      when c.proveedor_id is not null then 'ficha'
      else 'muro'
    end as tipo,
    coalesce(
      c.respuesta_servicio_id, c.respuesta_insumo_id, c.producto_id,
      c.proveedor_id, c.publicacion_id
    ) as origen_id,
    coalesce(
      pv.perfil_id,
      ri.autor_id,
      pp.perfil_id,
      pf.perfil_id,
      case when pm.cara = 'ofrece' then pm.perfil_id else c.iniciado_por end
    ) as ofrece_id,
    coalesce(
      ss.perfil_id,
      si.perfil_id,
      case when c.producto_id is not null or c.proveedor_id is not null
           then c.iniciado_por end,
      case when pm.cara = 'necesita' then pm.perfil_id else c.iniciado_por end
    ) as pide_id,
    c.visto_ofrece_at,
    c.visto_pide_at,
    coalesce(ss.detalle, si.categoria, pr.nombre, pm.titulo) as asunto,
    coalesce(
      pv.nombre_visible,
      pp.nombre_visible,
      pf.nombre_visible,
      case when pm.cara = 'ofrece' then pm.autor_nombre end
    ) as nombre_ofrece,
    case when pm.cara = 'necesita' then pm.autor_nombre end as nombre_pide
  from chats c
  left join respuestas_servicio rs on rs.id = c.respuesta_servicio_id
  left join solicitudes_servicio ss on ss.id = rs.solicitud_id
  left join proveedores pv on pv.id = rs.proveedor_id
  left join respuestas ri on ri.id = c.respuesta_insumo_id
  left join solicitudes si on si.id = ri.solicitud_id
  left join productos pr on pr.id = c.producto_id
  left join proveedores pp on pp.id = pr.proveedor_id
  left join proveedores pf on pf.id = c.proveedor_id
  left join publicaciones_muro pm on pm.id = c.publicacion_id
`

/**
 * Si el otro lado escribió después de la última vez que yo miré.
 *
 * `is null` cuenta como sin leer: un hilo que nunca abrí y ya tiene un
 * mensaje del otro es exactamente lo que el menú tiene que avisar.
 */
const sinLeerDe = (yo: string) => sql`
  exists (
    select 1 from mensajes m
    where m.chat_id = h.id
      and not m.oculto
      and m.autor <> (case when h.ofrece_id = ${yo} then 'ofrece' else 'pide' end)
      and m.creado_at > coalesce(
        case when h.ofrece_id = ${yo} then h.visto_ofrece_at else h.visto_pide_at end,
        '-infinity'::timestamptz
      )
  )
`

/**
 * La bandeja: todos los hilos de quien está en sesión, de los dos lados y de
 * los cuatro módulos.
 *
 * En SQL crudo y no con el constructor de consultas a propósito. Son cinco
 * orígenes con cinco cadenas de `join` distintas que hay que aplanar a una
 * sola forma de fila; la alternativa —cinco consultas y mezclar en
 * TypeScript— sería exactamente la lógica repetida que este cambio vino a
 * quitar.
 */
export async function bandeja(
  db: BaseDeDatos,
  usuarioId: string | null,
): Promise<HiloEnBandeja[]> {
  if (!usuarioId) return []

  const { rows } = await db.execute<FilaBandeja>(sql`
    with hilos as (${HILOS})
    select h.tipo, h.origen_id, h.ofrece_id, h.pide_id, h.asunto,
           h.nombre_ofrece, h.nombre_pide,
           u.cuerpo as ultimo, u.creado_at as ultimo_at,
           coalesce(n.total, 0)::int as mensajes,
           ${sinLeerDe(usuarioId)} as sin_leer
    from hilos h
    left join lateral (
      select m.cuerpo, m.creado_at from mensajes m
      where m.chat_id = h.id and not m.oculto
      order by m.creado_at desc limit 1
    ) u on true
    left join lateral (
      select count(*)::int as total from mensajes m
      where m.chat_id = h.id and not m.oculto
    ) n on true
    where ${usuarioId} in (h.ofrece_id, h.pide_id)
    order by u.creado_at desc nulls last
  `)

  return rows.map((f) => {
    const anonimo = ANONIMO[f.tipo]
    return {
      origen: { tipo: f.tipo, id: f.origen_id },
      con:
        f.ofrece_id === usuarioId
          ? (f.nombre_pide ?? anonimo.pide)
          : (f.nombre_ofrece ?? anonimo.ofrece),
      asunto: f.asunto,
      ultimo: f.ultimo,
      ultimo_at: f.ultimo_at ? String(f.ultimo_at) : null,
      mensajes: Number(f.mensajes),
      sin_leer: f.sin_leer,
    }
  })
}

/**
 * Cuántos hilos tienen algo sin leer. Para el punto de la barra.
 *
 * Cuenta hilos y no mensajes: la pregunta que responde el menú es «¿tengo
 * algo?», y un número de mensajes obligaría a decidir si veinte mensajes de
 * una persona son más urgentes que uno de tres.
 */
export async function sinLeer(
  db: BaseDeDatos,
  usuarioId: string | null,
): Promise<number> {
  if (!usuarioId) return 0

  const { rows } = await db.execute<{ total: number }>(sql`
    with hilos as (${HILOS})
    select count(*)::int as total from hilos h
    where ${usuarioId} in (h.ofrece_id, h.pide_id) and ${sinLeerDe(usuarioId)}
  `)

  return Number(rows[0]?.total ?? 0)
}
