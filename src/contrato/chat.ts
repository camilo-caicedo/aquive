import { oc } from '@orpc/contract'
import { z } from 'zod'

// El chat, uno solo para toda la aplicación.
//
// Nació atado a los pedidos de servicio y era el único que había: productos,
// donaciones e insumos no tenían ninguno y el contacto era por fuera. Ahora
// un hilo cuelga de cualquiera de las cinco cosas que dos personas pueden
// tener que acordar, y de ahí salen los dos papeles.
//
// Los botones de WhatsApp y de llamar se quedan donde están. Quien publica
// una ficha o un producto puso su teléfono a propósito; el chat es la puerta
// para quien NO quiere dar el suyo, no un reemplazo de la que ya existe.

/** De qué cuelga un hilo. Muere con ello — regla de producto 3. */
export const Origen = z.object({
  tipo: z.enum(['servicio', 'insumo', 'producto', 'muro', 'ficha']),
  id: z.uuid(),
})

export type Origen = z.infer<typeof Origen>

/**
 * Los dos papeles, con los mismos nombres en los cuatro módulos.
 *
 * `ofrece` tiene la cosa o el trabajo; `pide` la necesita. Antes eran
 * `prestador` y `quien_pide`, que solo sabían hablar de servicios.
 */
export const Autor = z.enum(['pide', 'ofrece'])
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
  origen: Origen,
  cerrado: z.boolean(),
  /** Quién es el otro. Tiene nombre solo si lo publicó él mismo. */
  con: z.string(),
  /**
   * De qué lado está quien pidió el hilo.
   *
   * Lo decide el servidor, que es quien sabe de quién es cada cosa. El
   * cliente no puede deducirlo: desde el ADR 0006 las dos partes son
   * cuentas y no hay ninguna pista en lo que trae la petición.
   */
  soy: Autor,
  /** De qué va: el oficio, el producto, el título del muro, la categoría. */
  asunto: z.string().nullable(),
  mensajes: z.array(Mensaje),
})

export type Hilo = z.infer<typeof Hilo>

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

/** Una fila de la bandeja. */
export const HiloEnBandeja = z.object({
  origen: Origen,
  con: z.string(),
  asunto: z.string().nullable(),
  ultimo: z.string().nullable(),
  ultimo_at: z.string().nullable(),
  mensajes: z.number(),
  /** Si el otro escribió después de la última vez que abrí el hilo. */
  sin_leer: z.boolean(),
})

export type HiloEnBandeja = z.infer<typeof HiloEnBandeja>

export const contratoChat = {
  /**
   * Los hilos de quien está en sesión, de los dos lados y de los cuatro
   * módulos. Una sola bandeja porque es una sola clase de cosa: con quién
   * estás hablando y de qué.
   */
  bandeja: oc.output(z.array(HiloEnBandeja)),

  /**
   * Cuántos hilos tienen algo sin leer. Lo pide la barra de navegación en
   * cada carga con sesión, así que devuelve un número y nada más: la lista
   * la sirve `bandeja`, y traerla entera para pintar un punto sería pagar
   * cinco `join` en cada pantalla del sitio.
   */
  sinLeer: oc.output(z.number()),

  /** El hilo, con sus mensajes. Se crea al abrirlo. Pantalla 12. */
  leer: oc.errors(errores).input(z.object({ origen: Origen })).output(Hilo.nullable()),

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
    .input(z.object({ origen: Origen, cuerpo: z.string().trim().min(1).max(500) }))
    .output(z.object({ mensaje: Mensaje })),
}
