import { createHash, randomBytes } from 'node:crypto'

import { sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { contienePII } from '@/lib/validacion'
import { PLAZO_HABIL, type TipoPqr } from '@/contrato/pqr'

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
