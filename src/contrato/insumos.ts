import { oc } from '@orpc/contract'
import { z } from 'zod'

// Insumos: el módulo que nació con el sismo del 10 de agosto de 2026 y se
// queda. Quien necesita publica qué le falta; quien puede, responde.
//
// ⚠ Desde el ADR 0006 exige cuenta. Lo que se le PIDE a quien pide no
// cambió: municipio, barrio, categoría, los ítems y la nota filtrada. Ni
// nombre, ni teléfono, ni dirección exacta.

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
})

export type MiSolicitudInsumos = z.infer<typeof MiSolicitudInsumos>

export const contratoInsumos = {
  publicar: oc
    .errors(errores)
    .input(
      z.object({
        municipio: z.string().regex(/^[0-9]{5}$/),
        barrio: z.string().trim().min(2).max(80),
        categoria: z.string().trim().min(1).max(40),
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

  /** Renovar por otras 72 horas, o cerrar. */
  gestionar: oc
    .errors(errores)
    .input(z.object({ id: z.uuid(), accion: z.enum(['renovar', 'cerrar']) }))
    .output(z.object({ ok: z.literal(true) })),
}
