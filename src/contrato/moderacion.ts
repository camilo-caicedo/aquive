import { oc } from '@orpc/contract'
import { z } from 'zod'

// Reportar contenido. Aparte de Servicios a propósito: se reporta una ficha,
// una reseña, una solicitud o una entidad, y ninguno de esos es del mismo
// módulo.

export const TipoObjeto = z.enum([
  'solicitud',
  'respuesta',
  'perfil',
  'entidad',
  'proveedor',
  'resena',
])

export const Motivo = z.enum([
  'datos_personales',
  'estafa',
  'contenido_ofensivo',
  'informacion_falsa',
  'menor_de_edad',
  'extorsion_resena',
  'discriminacion',
  'otro',
])

export type TipoObjeto = z.infer<typeof TipoObjeto>
export type Motivo = z.infer<typeof Motivo>

export const contratoModeracion = {
  /**
   * Reportar algo para que lo mire una persona.
   *
   * Abierto sin cuenta a propósito: quien ve datos personales de un menor en
   * una ficha puede no tener cuenta, y exigirle una para avisar es garantizar
   * que no avise. La nota va con tope y se limpia; los dos enums son gemelos
   * de los `CHECK` de la tabla.
   */
  reportar: oc
    .input(
      z.object({
        tipo_objeto: TipoObjeto,
        objeto_id: z.uuid(),
        motivo: Motivo,
        nota: z.string().trim().max(300).optional(),
      }),
    )
    .output(z.object({ ok: z.literal(true) })),
}
