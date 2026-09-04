import { and, asc, eq, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { avisar } from '@/server/avisos/push'
import {
  catalogoOficios,
  chats,
  mensajes as mensajesTabla,
  productos,
  proveedorOficios,
  proveedores,
  publicacionesMuro,
  solicitudesServicio,
  sugerenciasItem,
} from '@/db/esquema'
import { MENSAJE_CONTACTO, contieneContacto } from '@/lib/validacion'
import type { Autor, Hilo, HiloEnBandeja, Mensaje, Origen, OrdenDelChat } from '@/contrato/chat'

// El chat, uno solo. Capa de dominio: sin `next/*`, sin cookies.
//
// Un hilo tiene siempre dos lados —quien ofrece y quien pide— y lo único que
// cambia entre los cuatro orígenes es de dónde salen esos dos lados. Eso vive
// en `partes()`, que es la única función que sabe que existen módulos. Todo
// lo demás —el filtro, los mensajes, la bandeja— es común.

/**
 * Los dos lados de un hilo.
 *
 * Un lado en `null` significa «lo ocupa quien abra el hilo». Pasa cuando el
 * origen solo identifica a uno: una ficha dice quién trabaja pero no quién lo
 * necesita, un producto dice quién vende pero no quién pregunta, y una
 * publicación del muro dice quién dona pero no quién recibe. Una orden (ADR
 * 0015) es la excepción: identifica a los dos desde que nace, así que
 * ninguno de sus dos lados es nunca `null`.
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
  producto: { ofrece: 'Quien vende', pide: 'Quien preguntó' },
  muro: { ofrece: 'Quien lo ofrece', pide: 'Quien lo necesita' },
  ficha: { ofrece: 'El prestador', pide: 'Quien preguntó' },
  // El mínimo legal no cambia con el ADR 0015: quien pide sigue sin publicar
  // su nombre, así que del lado del prestador este texto es el único que
  // sale de verdad, nunca un nombre real.
  solicitud: { ofrece: 'El prestador', pide: 'Quien pidió' },
}

/** De dónde salen los dos lados. La única función que distingue módulos. */
async function partes(db: BaseDeDatos, origen: Origen): Promise<Partes | null> {
  if (origen.tipo === 'ficha') {
    const [f] = await db
      .select({ ofrece: proveedores.perfilId, nombreOfrece: proveedores.nombreVisible })
      .from(proveedores)
      .where(eq(proveedores.id, origen.id))
      .limit(1)
    // Sin asunto: el hilo es con la persona, y su nombre ya va en `con`.
    return f ? { ...f, pide: null, asunto: null, nombrePide: null } : null
  }

  if (origen.tipo === 'solicitud') {
    // La orden ya identifica a los dos lados desde que nace (ADR 0015): a
    // diferencia de la ficha, el producto y el muro, aquí nunca hay un lado
    // que «lo ocupe quien abra el hilo».
    const [f] = await db
      .select({
        ofrece: proveedores.perfilId,
        pide: solicitudesServicio.perfilId,
        nombreOfrece: proveedores.nombreVisible,
        oficioNombre: catalogoOficios.nombre,
        propuesta: sugerenciasItem.nombrePropuesto,
      })
      .from(solicitudesServicio)
      .innerJoin(proveedores, eq(proveedores.id, solicitudesServicio.proveedorId))
      .leftJoin(catalogoOficios, eq(catalogoOficios.id, solicitudesServicio.oficioId))
      .leftJoin(sugerenciasItem, eq(sugerenciasItem.id, solicitudesServicio.sugerenciaId))
      .where(eq(solicitudesServicio.id, origen.id))
      .limit(1)
    return f
      ? {
          ofrece: f.ofrece,
          pide: f.pide,
          asunto: f.oficioNombre ?? f.propuesta,
          nombreOfrece: f.nombreOfrece,
          nombrePide: null,
        }
      : null
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

  // El muro solo tiene la cara «ofrece» desde el ADR 0014: el dueño de la
  // publicación siempre la tiene, nunca la necesita.
  const [f] = await db
    .select({
      perfil: publicacionesMuro.perfilId,
      asunto: publicacionesMuro.titulo,
      nombre: publicacionesMuro.autorNombre,
    })
    .from(publicacionesMuro)
    .where(eq(publicacionesMuro.id, origen.id))
    .limit(1)

  if (!f) return null

  return {
    ofrece: f.perfil,
    pide: null,
    asunto: f.asunto,
    nombreOfrece: f.nombre,
    nombrePide: null,
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
    case 'producto':
      return and(eq(chats.productoId, origen.id), eq(chats.iniciadoPor, iniciadoPor!)) as SQL
    case 'muro':
      return and(eq(chats.publicacionId, origen.id), eq(chats.iniciadoPor, iniciadoPor!)) as SQL
    case 'ficha':
      return and(eq(chats.proveedorId, origen.id), eq(chats.iniciadoPor, iniciadoPor!)) as SQL
    // La orden ya identifica a los dos lados: no hay `iniciado_por` que
    // comprobar, solo cuál orden es.
    case 'solicitud':
      return eq(chats.solicitudServicioId, origen.id) as SQL
  }
}

function valores(origen: Origen, iniciadoPor: string | null) {
  switch (origen.tipo) {
    case 'producto':
      return { productoId: origen.id, iniciadoPor }
    case 'muro':
      return { publicacionId: origen.id, iniciadoPor }
    case 'ficha':
      return { proveedorId: origen.id, iniciadoPor }
    case 'solicitud':
      return { solicitudServicioId: origen.id }
  }
}

/**
 * La orden que abrió el hilo, para la tarjeta fija arriba de la
 * conversación (ADR 0015). `null` fuera del origen `solicitud`.
 *
 * El precio sale de `proveedor_oficios`, no de un valor guardado en la
 * solicitud: si el prestador cambió su tarifa después de que le pidieran
 * esto, la orden muestra el precio de HOY, que es con el que se va a
 * acordar. Si el prestador quitó ese oficio de su ficha, el `left join` no
 * encuentra nada y `modo` sale `null` — la tarjeta sigue diciendo qué se
 * pidió, solo que sin precio.
 */
async function datosOrden(db: BaseDeDatos, solicitudId: string): Promise<OrdenDelChat | null> {
  const [f] = await db
    .select({
      oficioNombre: catalogoOficios.nombre,
      propuesta: sugerenciasItem.nombrePropuesto,
      modo: proveedorOficios.modo,
      precioDesde: proveedorOficios.precioDesde,
      unidad: proveedorOficios.unidad,
      detalle: solicitudesServicio.detalle,
      nota: solicitudesServicio.nota,
      estado: solicitudesServicio.estado,
    })
    .from(solicitudesServicio)
    .leftJoin(catalogoOficios, eq(catalogoOficios.id, solicitudesServicio.oficioId))
    .leftJoin(sugerenciasItem, eq(sugerenciasItem.id, solicitudesServicio.sugerenciaId))
    .leftJoin(
      proveedorOficios,
      and(
        eq(proveedorOficios.proveedorId, solicitudesServicio.proveedorId),
        eq(proveedorOficios.oficioId, solicitudesServicio.oficioId),
      ),
    )
    .where(eq(solicitudesServicio.id, solicitudId))
    .limit(1)

  if (!f) return null

  return {
    oficio: f.oficioNombre ?? f.propuesta ?? 'Lo que pidió',
    modo: f.modo as OrdenDelChat['modo'],
    precio_desde: f.precioDesde !== null ? Number(f.precioDesde) : null,
    unidad: f.unidad as OrdenDelChat['unidad'],
    detalle: f.detalle,
    nota: f.nota,
    estado: f.estado as OrdenDelChat['estado'],
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
  const orden = origen.tipo === 'solicitud' ? await datosOrden(db, origen.id) : null

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
    orden,
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

  // Avisarle al otro lado. Best-effort y sin await bloqueante en la
  // respuesta: el mensaje ya está guardado, y quien escribe no tiene que
  // esperar a que un servicio de push conteste.
  //
  // ⚠ El aviso NO lleva el mensaje. Se ve en la pantalla bloqueada de un
  // teléfono que puede estar en otra mano, y este chat existe justamente
  // para que lo que se acuerda no salga de aquí.
  const otro = autor === 'ofrece' ? p.pide : p.ofrece
  if (otro && otro !== llave.usuarioId) {
    await avisar(db, otro, {
      cuerpo: 'Tienes un mensaje nuevo en AquíVe',
      url: `/chat/${entrada.origen.tipo}/${entrada.origen.id}`,
      // Un hilo, un aviso: los mensajes seguidos del mismo hilo se apilan
      // en vez de sonar cinco veces.
      tag: `chat-${entrada.origen.tipo}-${entrada.origen.id}`,
    })
  }

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
 * El SQL que aplana los cuatro orígenes a una sola forma de fila.
 *
 * Lo usan la bandeja y el contador del menú, y por eso está aquí fuera: dos
 * copias de estos `join` se separarían el día que aparezca un quinto origen,
 * y entonces el menú contaría hilos que la bandeja no enseña.
 *
 * ⚠ El muro solo tiene la cara «ofrece» desde el ADR 0014, así que
 * `pm.perfil_id` siempre es quien ofrece y el otro lado lo ocupa siempre
 * quien inició el hilo. La orden (ADR 0015) es la excepción: ya trae los dos
 * lados, así que `pide_id` sale de ella y no de `iniciado_por`, que aquí
 * siempre es nulo.
 */
const HILOS = sql`
  select
    c.id,
    case
      when c.producto_id is not null then 'producto'
      when c.proveedor_id is not null then 'ficha'
      when c.solicitud_servicio_id is not null then 'solicitud'
      else 'muro'
    end as tipo,
    coalesce(c.producto_id, c.proveedor_id, c.solicitud_servicio_id, c.publicacion_id) as origen_id,
    coalesce(pp.perfil_id, pf.perfil_id, ssp.perfil_id, pm.perfil_id) as ofrece_id,
    coalesce(c.iniciado_por, ss.perfil_id) as pide_id,
    c.visto_ofrece_at,
    c.visto_pide_at,
    coalesce(pr.nombre, pm.titulo, sso.nombre, sgi.nombre_propuesto) as asunto,
    coalesce(pp.nombre_visible, pf.nombre_visible, ssp.nombre_visible, pm.autor_nombre) as nombre_ofrece,
    null::text as nombre_pide
  from chats c
  left join productos pr on pr.id = c.producto_id
  left join proveedores pp on pp.id = pr.proveedor_id
  left join proveedores pf on pf.id = c.proveedor_id
  left join publicaciones_muro pm on pm.id = c.publicacion_id
  left join solicitudes_servicio ss on ss.id = c.solicitud_servicio_id
  left join proveedores ssp on ssp.id = ss.proveedor_id
  left join catalogo_oficios sso on sso.id = ss.oficio_id
  left join sugerencias_item sgi on sgi.id = ss.sugerencia_id
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
 * los cuatro orígenes.
 *
 * En SQL crudo y no con el constructor de consultas a propósito. Son cuatro
 * orígenes con cuatro cadenas de `join` distintas que hay que aplanar a una
 * sola forma de fila; la alternativa —cuatro consultas y mezclar en
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
