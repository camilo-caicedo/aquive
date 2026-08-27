import { oc } from '@orpc/contract'
import { z } from 'zod'

// Las cuentas que crea un admin para quien no tiene Google (ADR 0006).
//
// Es la puerta que hace aceptable exigir cuenta para todo: sin ella, el
// cambio deja fuera a buena parte del rebusque, que es justo el público que
// la aplicación busca.

const errores = {
  RECHAZADO: {
    status: 400,
    message: 'No se pudo crear la cuenta.',
    data: z.object({ motivo: z.string() }),
  },
} as const

export const contratoCuentas = {
  /**
   * Dar de alta a alguien.
   *
   * Devuelve el código EN CLARO, y es la única vez que existe: se guarda
   * solo su `sha256`. Si quien lo crea cierra sin copiarlo, hay que
   * regenerarlo — y la pantalla lo dice en grande antes de guardar.
   */
  crear: oc
    .errors(errores)
    .input(
      z.object({
        nombre_visible: z.string().trim().min(3).max(60),
        /** Solo para quien va a ofrecer algo. Quien solo pide no lo da. */
        contacto_publico: z.string().trim().min(7).max(40).optional(),
        contacto_tipo: z.enum(['whatsapp', 'telefono']).optional(),
        municipios: z.array(z.string().regex(/^[0-9]{5}$/)).min(1),
        tipo: z.enum(['vecino', 'ofertador', 'servidor']),
      }),
    )
    .output(z.object({ perfil_id: z.uuid(), codigo: z.string() })),

  /** Cuando alguien pierde el papel, o se lo quitan. */
  regenerar: oc
    .errors(errores)
    .input(z.object({ perfil_id: z.uuid() }))
    .output(z.object({ codigo: z.string() })),
}
