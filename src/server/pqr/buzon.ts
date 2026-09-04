import { createHash, randomBytes } from 'node:crypto'

import { sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { contienePII } from '@/lib/validacion'
import { PLAZO_HABIL, type MiPqr, type PqrEnCola, type TipoPqr } from '@/contrato/pqr'
import { esAdmin } from '@/server/imagenes/recorrido'

export class PqrRechazada extends Error {}

/**
 * Guardar una PQR.
 *
 * El filtro de PII se comprueba aquí antes de escribir, aunque la tabla lo
 * repita en un CHECK: así el rechazo llega en castellano y con la salida
 * incluida, en vez de como un error de Postgres que la pantalla no puede
 * explicar.
 *
 * Se escribe con SQL a pelo y no con el esquema de Drizzle porque la tabla
 * es nueva y `src/db/esquema.ts` es generado: la fila se inserta igual y no
 * hace falta regenerar tipos para una sola sentencia.
 */
export async function crear(
  db: BaseDeDatos,
  entrada: { tipo: TipoPqr; asunto: string; detalle: string },
): Promise<{ codigo: string; plazo_habil: number }> {
  for (const texto of [entrada.asunto, entrada.detalle]) {
    if (contienePII(texto)) {
      throw new PqrRechazada(
        'No escribas teléfonos, correos ni números de identificación. Si vas a nombrar a alguien, usa el código del servicio o de la solicitud.',
      )
    }
  }

  // Mismo mecanismo que una solicitud: 32 bytes, se guarda solo el hash, se
  // muestra una vez. Es lo único que identifica el caso, y a propósito no
  // se puede recuperar.
  const codigo = randomBytes(32).toString('base64url')

  await db.execute(sql`
    insert into public.pqr (tipo, asunto, detalle, token_hash)
    values (
      ${entrada.tipo},
      ${entrada.asunto},
      ${entrada.detalle},
      ${createHash('sha256').update(codigo).digest('hex')}
    )
  `)

  return { codigo, plazo_habil: PLAZO_HABIL[entrada.tipo] }
}

/**
 * Días HÁBILES entre dos fechas, sin contar sábados ni domingos.
 *
 * ⚠ No cuenta festivos. Colombia tiene dieciocho al año y una tabla de
 * festivos que hay que mantener; sin ella el número que se enseña puede ir
 * hasta tres días adelantado. Se acepta a propósito, y con este sesgo: el
 * plazo se ve MÁS corto de lo que la ley concede, nunca más largo, así que
 * quien atiende llega antes y no después. Si algún día importa afinarlo,
 * lo que hace falta es la tabla, no otro cálculo.
 */
function habilesDesde(desde: Date, hasta: Date): number {
  let dias = 0
  const cursor = new Date(desde)
  cursor.setHours(0, 0, 0, 0)
  const fin = new Date(hasta)
  fin.setHours(0, 0, 0, 0)

  while (cursor < fin) {
    cursor.setDate(cursor.getDate() + 1)
    const d = cursor.getDay()
    if (d !== 0 && d !== 6) dias++
  }
  return dias
}

/**
 * La propia, con el código.
 *
 * ⚠ Sin cuenta, y tiene que ser así: es el canal de habeas data (mínimo
 * legal 3), y condicionarlo a tener cuenta de Google lo haría inejercible.
 * Lo único que hace de llave es el código, del que aquí solo vive el hash.
 */
export async function porCodigo(
  db: BaseDeDatos,
  codigo: string,
): Promise<MiPqr | null> {
  const hash = createHash('sha256').update(codigo).digest('hex')

  const filas = await db.execute<{
    tipo: string
    asunto: string
    detalle: string
    estado: string
    respuesta: string | null
    creada_at: string
    respondida_at: string | null
  }>(sql`
    select tipo, asunto, detalle, estado, respuesta, creada_at, respondida_at
      from public.pqr
     where token_hash = ${hash}
     limit 1
  `)

  const f = filas.rows[0]
  if (!f) return null

  return {
    tipo: f.tipo as TipoPqr,
    asunto: f.asunto,
    detalle: f.detalle,
    estado: f.estado as 'abierta' | 'respondida',
    respuesta: f.respuesta,
    creada_at: String(f.creada_at),
    respondida_at: f.respondida_at ? String(f.respondida_at) : null,
    plazo_habil: PLAZO_HABIL[f.tipo as TipoPqr],
  }
}

/**
 * La cola de quien atiende, lo más viejo primero.
 *
 * Lo más viejo primero y no lo más urgente: el orden de llegada es el que
 * la ley reconoce, y ordenar por «a punto de vencer» premia dejar las cosas
 * para el final.
 */
export async function cola(
  db: BaseDeDatos,
  usuarioId: string | null,
): Promise<PqrEnCola[]> {
  if (!(await esAdmin(db, usuarioId))) return []

  const filas = await db.execute<{
    id: string
    tipo: string
    asunto: string
    detalle: string
    estado: string
    respuesta: string | null
    creada_at: string
    respondida_at: string | null
  }>(sql`
    select id, tipo, asunto, detalle, estado, respuesta, creada_at, respondida_at
      from public.pqr
     order by estado = 'respondida', creada_at
     limit 200
  `)

  const ahora = new Date()
  return filas.rows.map((f) => {
    const plazo = PLAZO_HABIL[f.tipo as TipoPqr]
    const corridos = habilesDesde(new Date(f.creada_at), ahora)
    return {
      id: f.id,
      tipo: f.tipo as TipoPqr,
      asunto: f.asunto,
      detalle: f.detalle,
      estado: f.estado as 'abierta' | 'respondida',
      respuesta: f.respuesta,
      creada_at: String(f.creada_at),
      respondida_at: f.respondida_at ? String(f.respondida_at) : null,
      plazo_habil: plazo,
      dias_restantes: plazo - corridos,
    }
  })
}

/** Responder una PQR. Solo administradores. */
export async function responder(
  db: BaseDeDatos,
  entrada: { id: string; respuesta: string },
  usuarioId: string | null,
): Promise<{ ok: true }> {
  if (!(await esAdmin(db, usuarioId))) {
    throw new PqrRechazada('Esto solo lo puede hacer un administrador.')
  }

  const respuesta = entrada.respuesta.trim()
  // La respuesta la lee quien tenga el código, así que pasa por el mismo
  // filtro que todo lo demás: quien atiende no puede escribir ahí el
  // teléfono de un tercero.
  if (contienePII(respuesta)) {
    throw new PqrRechazada(
      'La respuesta no puede llevar teléfonos, correos ni números de identificación.',
    )
  }

  const filas = await db.execute<{ id: string }>(sql`
    update public.pqr
       set respuesta = ${respuesta},
           estado = 'respondida',
           respondida_at = now()
     where id = ${entrada.id}
    returning id
  `)

  if (filas.rows.length === 0) throw new PqrRechazada('Esa PQR no existe.')
  return { ok: true }
}
