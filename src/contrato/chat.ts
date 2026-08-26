import { oc } from '@orpc/contract'
import { z } from 'zod'

// El chat de Servicios. ADR 0003, decisión 1.
//
// Bilateral: quien pide un servicio y el prestador que respondió. Nada que
// ver con `conversaciones`, que es el hilo trilateral del flujo acompañado.

export const Autor = z.enum(['quien_pide', 'prestador'])
export type Autor = z.infer<typeof Autor>

export const Mensaje = z.object({
  id: z.uuid(),
  autor: Autor,
  cuerpo: z.string(),
  creado_at: z.string(),
})

export type Mensaje = z.infer<typeof Mensaje>

export const Hilo = z.object({
  id: z.uuid(),
  respuesta_id: z.uuid(),
  cerrado: z.boolean(),
  /** Quién es el otro. El prestador tiene nombre público; quien pide, no. */
  con: z.string(),
  oficio: z.string().nullable(),
  mensajes: z.array(Mensaje),
})

export type Hilo = z.infer<typeof Hilo>

/**
 * Cómo se entra al hilo.
 *
 * Dos puertas distintas porque hay dos clases de participante, y esa
 * asimetría es del producto, no del código: el prestador tiene cuenta y el
 * hilo le sale de su sesión; quien pide NO tiene cuenta y entra con el token
 * de su solicitud, que es lo único que la plataforma le dio.
 */
export const Llave = z.union([
  z.object({ token: z.string().min(20) }),
  z.object({ respuesta_id: z.uuid() }),
])

/**
 * Los rechazos del hilo, declarados en el contrato y no improvisados.
 *
 * Sin esto, un mensaje con un teléfono volvía como 500 «Internal server
 * error» y quien escribía leía «algo salió mal» — cuando lo que hacía falta
 * decirle es exactamente por qué no se envió, que es la mitad del valor del
 * filtro. Un filtro que rechaza sin explicar enseña a la gente a pelear con
 * la pantalla, no a coordinar por aquí.
 */
const errores = {
  RECHAZADO: {
    status: 400,
    message: 'El mensaje no se pudo enviar.',
    data: z.object({ motivo: z.string() }),
  },
} as const

export const contratoChat = {
  /** El hilo abierto por una respuesta, con sus mensajes. Pantalla 12. */
  leer: oc
    .errors(errores)
    .input(z.object({ respuesta_id: z.uuid(), token: z.string().min(20).optional() }))
    .output(Hilo.nullable()),

  /**
   * Escribir en el hilo.
   *
   * El cuerpo pasa por el filtro de datos de contacto en el servidor, no
   * aquí: la lista de patrones —`wa.me`, arrobas sueltas, números escritos
   * con letras— se afina con el tiempo, y un contrato que la llevara dentro
   * obligaría a versionar el contrato cada vez que aparece una forma nueva
   * de colar un teléfono.
   *
   * Sin ese filtro el chat es solo una manera más lenta de pedir el número
   * por fuera, y entonces no protege a nadie.
   */
  escribir: oc
    .errors(errores)
    .input(
      z.object({
        respuesta_id: z.uuid(),
        token: z.string().min(20).optional(),
        cuerpo: z.string().trim().min(1).max(500),
      }),
    )
    .output(z.object({ mensaje: Mensaje })),
}
