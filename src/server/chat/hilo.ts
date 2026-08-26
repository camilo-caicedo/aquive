import { createHash } from 'node:crypto'

import { and, asc, eq } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import {
  catalogoOficios,
  chatsServicio,
  mensajesServicio,
  proveedores,
  respuestasServicio,
  solicitudesServicio,
} from '@/db/esquema'
import { MENSAJE_CONTACTO, contieneContacto } from '@/lib/validacion'
import type { Autor, Hilo, Mensaje } from '@/contrato/chat'

// El chat de Servicios. Capa de dominio: sin `next/*`, sin cookies.
//
// Dos participantes con dos formas de identificarse, y esa asimetría no es
// accidental. El prestador tiene cuenta. Quien pide NO la tiene —publicó su
// solicitud sin dar un solo dato— y entra con el token que se le mostró una
// vez. Se guarda `sha256(token)`, nunca el token, igual que en el resto de la
// plataforma.

/** Quién está hablando, decidido por lo que trae y no por lo que dice. */
async function quienEs(
  db: BaseDeDatos,
  respuestaId: string,
  llave: { token?: string; usuarioId: string | null },
): Promise<Autor | null> {
  const [fila] = await db
    .select({
      tokenHash: solicitudesServicio.tokenHash,
      perfilId: proveedores.perfilId,
    })
    .from(respuestasServicio)
    .innerJoin(
      solicitudesServicio,
      eq(solicitudesServicio.id, respuestasServicio.solicitudId),
    )
    .innerJoin(proveedores, eq(proveedores.id, respuestasServicio.proveedorId))
    .where(eq(respuestasServicio.id, respuestaId))
    .limit(1)

  if (!fila) return null

  if (llave.token) {
    const hash = createHash('sha256').update(llave.token).digest('hex')
    // Comparación en tiempo constante no hace falta: el hash ya es el
    // secreto y una diferencia de microsegundos sobre 64 caracteres hex no
    // filtra nada aprovechable a través de la red.
    if (hash === fila.tokenHash) return 'quien_pide'
  }

  if (llave.usuarioId && fila.perfilId === llave.usuarioId) return 'prestador'

  return null
}

/** El hilo, creándolo si es la primera vez que alguien entra. */
export async function leer(
  db: BaseDeDatos,
  respuestaId: string,
  llave: { token?: string; usuarioId: string | null },
): Promise<Hilo | null> {
  const autor = await quienEs(db, respuestaId, llave)
  if (!autor) return null

  const [contexto] = await db
    .select({
      nombrePrestador: proveedores.nombreVisible,
      oficio: catalogoOficios.nombre,
    })
    .from(respuestasServicio)
    .innerJoin(proveedores, eq(proveedores.id, respuestasServicio.proveedorId))
    .innerJoin(
      solicitudesServicio,
      eq(solicitudesServicio.id, respuestasServicio.solicitudId),
    )
    .leftJoin(catalogoOficios, eq(catalogoOficios.id, solicitudesServicio.oficioId))
    .where(eq(respuestasServicio.id, respuestaId))
    .limit(1)

  // El hilo se crea al abrirlo y no al responder: una respuesta que nadie
  // abre no tiene por qué dejar una fila vacía en la base.
  let [chat] = await db
    .select({ id: chatsServicio.id, cerradoAt: chatsServicio.cerradoAt })
    .from(chatsServicio)
    .where(eq(chatsServicio.respuestaId, respuestaId))
    .limit(1)

  if (!chat) {
    const [creado] = await db
      .insert(chatsServicio)
      .values({ respuestaId })
      .onConflictDoNothing()
      .returning({ id: chatsServicio.id, cerradoAt: chatsServicio.cerradoAt })
    chat =
      creado ??
      (
        await db
          .select({ id: chatsServicio.id, cerradoAt: chatsServicio.cerradoAt })
          .from(chatsServicio)
          .where(eq(chatsServicio.respuestaId, respuestaId))
          .limit(1)
      )[0]
  }

  const mensajes = await db
    .select({
      id: mensajesServicio.id,
      autor: mensajesServicio.autor,
      cuerpo: mensajesServicio.cuerpo,
      creado_at: mensajesServicio.creadoAt,
    })
    .from(mensajesServicio)
    .where(
      and(eq(mensajesServicio.chatId, chat.id), eq(mensajesServicio.oculto, false)),
    )
    .orderBy(asc(mensajesServicio.creadoAt))

  return {
    id: chat.id,
    respuesta_id: respuestaId,
    cerrado: chat.cerradoAt !== null,
    // Quien pide no tiene nombre publicado y no se le inventa uno: al
    // prestador se le dice de qué pedido viene el hilo, no quién es.
    con:
      autor === 'quien_pide'
        ? (contexto?.nombrePrestador ?? 'El prestador')
        : 'Quien pidió el servicio',
    oficio: contexto?.oficio ?? null,
    mensajes: mensajes.map((m) => ({
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
  entrada: { respuestaId: string; cuerpo: string },
  llave: { token?: string; usuarioId: string | null },
): Promise<{ mensaje: Mensaje }> {
  const autor = await quienEs(db, entrada.respuestaId, llave)
  if (!autor) throw new ChatRechazado('No puedes escribir en este hilo.')

  const cuerpo = entrada.cuerpo.trim()
  if (contieneContacto(cuerpo)) throw new ChatRechazado(MENSAJE_CONTACTO)

  const [chat] = await db
    .select({ id: chatsServicio.id, cerradoAt: chatsServicio.cerradoAt })
    .from(chatsServicio)
    .where(eq(chatsServicio.respuestaId, entrada.respuestaId))
    .limit(1)

  if (!chat) throw new ChatRechazado('El hilo todavía no está abierto.')
  if (chat.cerradoAt !== null) throw new ChatRechazado('Este hilo ya se cerró.')

  const [creado] = await db
    .insert(mensajesServicio)
    .values({ chatId: chat.id, autor, cuerpo })
    .returning({
      id: mensajesServicio.id,
      autor: mensajesServicio.autor,
      cuerpo: mensajesServicio.cuerpo,
      creado_at: mensajesServicio.creadoAt,
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
