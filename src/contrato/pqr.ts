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
}
