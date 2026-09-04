import { oc } from '@orpc/contract'
import { z } from 'zod'

// Centros de acopio (ADR 0008). Un lugar físico donde se dejan y se
// entregan cosas. Lo lleva el rol de aliado, que se mantiene.

const errores = {
  RECHAZADO: {
    status: 400,
    message: 'No se pudo registrar.',
    data: z.object({ motivo: z.string() }),
  },
} as const

export const Acopio = z.object({
  id: z.uuid(),
  nombre: z.string(),
  tipo: z.string(),
  municipios: z.array(z.string()),
  direccion: z.string().nullable(),
  horario: z.string().nullable(),
  telefono: z.string().nullable(),
  /**
   * El punto del mapa.
   *
   * ⚠ Sin casilla de consentimiento, a diferencia de un prestador (ADR
   * 0004): la dirección de una bodega no es el domicilio de una persona,
   * así que no hay una segunda finalidad que autorizar. Es la diferencia
   * que justifica tratarlos distinto.
   */
  latitud: z.number().nullable(),
  longitud: z.number().nullable(),
})

export type Acopio = z.infer<typeof Acopio>

/**
 * Un movimiento del acopio: algo que entró o algo que salió.
 *
 * ⚠ Sin un solo dato personal, y eso es la mitad de su razón de ser: la
 * regla de producto 3 dice que `entregas` sobrevive al borrado de lo que la
 * originó, y solo puede sobrevivir si no lleva nada de nadie. Ítem, cantidad,
 * municipio y fecha. El código de la solicitud, cuando lo hay, va copiado
 * como texto y sin llave foránea, para que borrar la solicitud no se lo
 * lleve.
 */
export const Movimiento = z.object({
  id: z.uuid(),
  direccion: z.enum(['entra', 'sale']),
  nombre: z.string(),
  cantidad: z.number(),
  unidad: z.string(),
  municipio: z.string(),
  /** El código de la solicitud que respondió, si respondió a alguna. */
  solicitud_codigo: z.string().nullable(),
  recibido_at: z.string(),
})

export type Movimiento = z.infer<typeof Movimiento>

export const contratoAcopios = {
  /** Los que se pueden enseñar, para la lista y el mapa. */
  lista: oc
    .input(
      z.object({
        municipio: z.string().regex(/^[0-9]{5}$/).optional().catch(undefined),
      }),
    )
    .output(z.array(Acopio)),

  /**
   * Lo que ha entrado y salido de MI centro.
   *
   * ⚠ Ni esto ni `registrarMovimiento` existían. `entregas` llevaba desde
   * el ADR 0008 sin que ninguna pantalla, procedimiento ni función la
   * escribiera o la leyera, mientras «Cómo funciona» le prometía a la gente
   * que «en el acopio, registra qué entregaste».
   */
  movimientos: oc
    .input(z.object({ organizacion_id: z.uuid() }))
    .output(z.array(Movimiento)),

  /** Anotar que algo entró o salió. Solo el equipo de ese centro. */
  registrarMovimiento: oc
    .errors(errores)
    .input(
      z.object({
        organizacion_id: z.uuid(),
        direccion: z.enum(['entra', 'sale']),
        /** Del catálogo… */
        item_id: z.string().min(1).max(60).optional(),
        /** …o escrito a mano, y entonces se propone al catálogo. */
        sugerencia: z.string().trim().min(2).max(60).optional(),
        cantidad: z.number().positive().max(9999),
        municipio: z.string().regex(/^[0-9]{5}$/),
        /** Si respondió a una solicitud concreta. */
        solicitud_codigo: z.string().trim().min(4).max(12).optional(),
      }),
    )
    .output(z.object({ id: z.uuid() })),
}
