import { oc } from '@orpc/contract'
import { z } from 'zod'

// Insumos: el módulo que nació con el sismo del 10 de agosto de 2026 y se
// queda. Quien necesita publica qué le falta; quien puede, responde.
//
// ⚠ Desde el ADR 0006 exige cuenta. Lo que se le PIDE a quien pide no
// cambió: municipio, barrio, categoría, los ítems y la nota filtrada. Ni
// nombre, ni teléfono, ni dirección exacta.

/**
 * Las ocho categorías de insumos. Gemelas del CHECK de `solicitudes`.
 *
 * ⚠ Esto era `z.string().trim().min(1).max(40)`. La base sí lo restringe, así
 * que una categoría inventada no entraba — pero llegaba como violación de
 * restricción de Postgres, un error crudo que la pantalla no puede explicar.
 * La regla de producto 4 pide validación en servidor con mensaje.
 */
export const CategoriaInsumo = z.enum([
  'alimentacion',
  'aseo',
  'salud',
  'abrigo',
  'cocina',
  'otros',
  'servicios',
  'mascotas',
])

export type CategoriaInsumo = z.infer<typeof CategoriaInsumo>

const errores = {
  RECHAZADO: {
    status: 400,
    message: 'No se pudo publicar.',
    data: z.object({ motivo: z.string() }),
  },
} as const

/** Una solicitud de insumos propia. Sustituye a la lista de `localStorage`. */
export const MiSolicitudInsumos = z.object({
  id: z.uuid(),
  codigo: z.string(),
  barrio: z.string(),
  categoria: z.string(),
  estado: z.string(),
  creada_at: z.string(),
  expira_at: z.string(),
  num_respuestas: z.number(),
})

export type MiSolicitudInsumos = z.infer<typeof MiSolicitudInsumos>

/** Una solicitud vista por quien va a responderla. Sin nada de quien pidió. */
export const SolicitudParaResponder = z.object({
  id: z.uuid(),
  codigo: z.string(),
  municipio: z.string(),
  municipio_nombre: z.string().nullable(),
  barrio: z.string(),
  categoria: z.string(),
  nota: z.string().nullable(),
  puede_recoger: z.boolean(),
  creada_at: z.string(),
  expira_at: z.string(),
  items: z.array(z.object({ nombre: z.string(), cantidad: z.number(), unidad: z.string() })),
  /** Si YO ya respondí. Una respuesta por persona y solicitud. */
  ya_respondi: z.boolean(),
})

export type SolicitudParaResponder = z.infer<typeof SolicitudParaResponder>

export const contratoInsumos = {
  publicar: oc
    .errors(errores)
    .input(
      z.object({
        municipio: z.string().regex(/^[0-9]{5}$/),
        barrio: z.string().trim().min(2).max(80),
        categoria: CategoriaInsumo,
        nota: z.string().trim().max(140).optional(),
        puede_recoger: z.boolean().optional(),
        items: z
          .array(
            z.object({
              /** Del catálogo… */
              item_id: z.string().min(1).max(60).optional(),
              /** …o escrito a mano. Nunca los dos. */
              sugerencia: z.string().trim().min(2).max(60).optional(),
              cantidad: z.number().positive().max(9999),
            }),
          )
          .min(1)
          .max(20),
      }),
    )
    .output(z.object({ id: z.uuid(), codigo: z.string() })),

  /** Las mías, para el perfil. */
  mias: oc.output(z.array(MiSolicitudInsumos)),

  /**
   * Una solicitud por su código, para la pantalla de responder.
   *
   * El código va en el PATH, nunca en query string (regla de producto 9).
   * No es un secreto —está impreso en el tablero público— pero la costumbre
   * de no meter identificadores en la URL de consulta se sostiene o no se
   * sostiene.
   */
  porCodigo: oc
    .input(z.object({ codigo: z.string().trim().min(4).max(12) }))
    .output(SolicitudParaResponder.nullable()),

  /**
   * «Yo puedo ayudar».
   *
   * ⚠ Esto era la RPC `responder_solicitud` detrás de un Route Handler, y
   * el único botón que llevaba a ella apuntaba a `/responder/<codigo>`, una
   * ruta que el ADR 0006 borró: la mitad «quien puede, responde» del módulo
   * llevaba semanas sin entrada.
   */
  responder: oc
    .errors(errores)
    .input(
      z.object({
        codigo: z.string().trim().min(4).max(12),
        mensaje: z.string().trim().min(5).max(200),
        puede_llevar: z.boolean().optional(),
      }),
    )
    .output(z.object({ solicitud_id: z.uuid() })),

  /** Renovar por otras 72 horas, o cerrar. */
  gestionar: oc
    .errors(errores)
    .input(z.object({ id: z.uuid(), accion: z.enum(['renovar', 'cerrar']) }))
    .output(z.object({ ok: z.literal(true) })),
}
