import { oc } from '@orpc/contract'
import { z } from 'zod'

// PQR: peticiones, quejas, reclamos y sugerencias. Pantalla 38.
//
// Sin cuenta. Quien escribe recibe un código y de ese código aquí solo se
// guarda el sha256, como en el resto del sitio.

export const TipoPqr = z.enum(['peticion', 'queja', 'reclamo', 'sugerencia'])
export type TipoPqr = z.infer<typeof TipoPqr>

export const NOMBRE_TIPO_PQR: Record<TipoPqr, string> = {
  peticion: 'Petición',
  queja: 'Queja',
  reclamo: 'Reclamo',
  sugerencia: 'Sugerencia',
}

/**
 * El plazo de respuesta, en días HÁBILES.
 *
 * ⚠ Son los de los artículos 14 y 15 de la Ley 1581 de 2012 —diez días
 * hábiles una consulta, quince un reclamo—, no un número de cortesía. El
 * prototipo dibujaba «cinco días hábiles» para todo; se descartó por
 * decisión del responsable, porque prometer menos de lo que la ley concede
 * no ahorra nada y sí crea un incumplimiento donde no lo había.
 *
 * Una queja va con el plazo del reclamo: es la lectura prudente cuando lo
 * que se recibe no dice de cuál de los dos se trata.
 */
export const PLAZO_HABIL: Record<TipoPqr, number> = {
  peticion: 10,
  sugerencia: 10,
  queja: 15,
  reclamo: 15,
}

const errores = {
  RECHAZADO: {
    status: 400,
    message: 'No se pudo enviar.',
    data: z.object({ motivo: z.string() }),
  },
} as const

/** Una PQR como la ve quien la escribió, con su código. */
export const MiPqr = z.object({
  tipo: TipoPqr,
  asunto: z.string(),
  detalle: z.string(),
  estado: z.enum(['abierta', 'respondida']),
  respuesta: z.string().nullable(),
  creada_at: z.string(),
  respondida_at: z.string().nullable(),
  plazo_habil: z.number().int(),
})

export type MiPqr = z.infer<typeof MiPqr>

/** Una PQR en la cola de quien la atiende. La misma, sin el código. */
export const PqrEnCola = z.object({
  id: z.uuid(),
  tipo: TipoPqr,
  asunto: z.string(),
  detalle: z.string(),
  estado: z.enum(['abierta', 'respondida']),
  respuesta: z.string().nullable(),
  creada_at: z.string(),
  respondida_at: z.string().nullable(),
  plazo_habil: z.number().int(),
  /** Días hábiles que quedan. Negativo si el plazo ya se pasó. */
  dias_restantes: z.number().int(),
})

export type PqrEnCola = z.infer<typeof PqrEnCola>

export const contratoPqr = {
  /**
   * Poner una PQR. Pantalla 38.
   *
   * Devuelve el código una sola vez: es lo que identifica el caso cuando la
   * persona escriba después, y no se puede recuperar porque no está
   * guardado.
   */
  crear: oc
    .errors(errores)
    .input(
      z.object({
        tipo: TipoPqr,
        asunto: z.string().trim().min(3).max(140),
        detalle: z.string().trim().min(10).max(1000),
      }),
    )
    .output(
      z.object({
        codigo: z.string(),
        plazo_habil: z.number().int(),
      }),
    ),

  /**
   * Consultar la propia con el código.
   *
   * ⚠ Es la ÚNICA puerta sin cuenta que sobrevive al ADR 0006, y tiene que
   * serlo: es el canal de habeas data (mínimo legal 3, Ley 1581 arts. 14 y
   * 15), y condicionar ese derecho a tener cuenta de Google lo haría
   * inejercible.
   *
   * El código va en el PATH, nunca en query string (regla de producto 9).
   */
  porCodigo: oc.input(z.object({ codigo: z.string().min(10).max(120) })).output(MiPqr.nullable()),

  /** La cola de quien atiende. Solo administradores. */
  cola: oc.output(z.array(PqrEnCola)),

  /**
   * Responder.
   *
   * ⚠ La respuesta es pública para quien tenga el código, así que pasa por
   * el mismo filtro de PII que todo lo demás: quien atiende no puede
   * escribir ahí el teléfono de un tercero.
   */
  responder: oc
    .errors(errores)
    .input(z.object({ id: z.uuid(), respuesta: z.string().trim().min(10).max(2000) }))
    .output(z.object({ ok: z.literal(true) })),
}
