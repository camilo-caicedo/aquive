import { oc } from '@orpc/contract'
import { z } from 'zod'

// Las cuentas, por sus dos puertas.
//
// La primera: las que crea un admin para quien no tiene Google (ADR 0006). Es
// lo que hace aceptable exigir cuenta para todo — sin ella, el cambio deja
// fuera a buena parte del rebusque, que es justo el público que la aplicación
// busca.
//
// La segunda: la que abre cualquiera al entrar con Google (ADR 0015). Dos
// campos, sin declarar a qué vino. Están en el mismo archivo porque escriben
// la misma tabla con las mismas reglas, y separarlas era invitar a que una de
// las dos se olvidara de `contienePII`.

/**
 * Cuántos municipios puede declarar una cuenta.
 *
 * No es `LIMITE_MUNICIPIOS` de `lib/municipios`: aquel dice cuántos PINTA el
 * combobox de una vez, que es otra cosa. Este es un tope de entrada, y existe
 * para que nadie mande un arreglo de mil elementos por una ruta pública.
 * Diez son más de los que nadie declara: el alta pide uno.
 */
const TOPE_MUNICIPIOS = 10

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
   *
   * ⚠ La cuenta nace `vecino` siempre, y no lleva `tipo`. Un admin abre la
   * puerta; a qué entra lo decide su dueño, porque publicar los datos de
   * alguien necesita la firma de esa persona y no la de quien la registra
   * (mínimo legal 2).
   */
  crear: oc
    .errors(errores)
    .input(
      z.object({
        nombre_visible: z.string().trim().min(3).max(60),
        /**
         * Opcional, y privado. Sirve para que la fundación pueda volver a
         * llamar a esa persona; no lo publica nadie. Publicar es un acto
         * aparte y lo firma su dueño (ADR 0015).
         */
        contacto_publico: z.string().trim().min(7).max(40).optional(),
        contacto_tipo: z.enum(['whatsapp', 'telefono']).optional(),
        municipios: z.array(z.string().regex(/^[0-9]{5}$/)).min(1).max(TOPE_MUNICIPIOS),
      }),
    )
    .output(z.object({ perfil_id: z.uuid(), codigo: z.string() })),

  /**
   * Las que ha creado un admin, para poder encontrarlas.
   *
   * ⚠ Faltaba, y sin ella el botón de regenerar era inalcanzable aunque
   * existiera: no había forma de dar con la persona. Quien perdía su enlace
   * —la única llave de quien no tiene Google— quedaba fuera para siempre.
   *
   * NO devuelve el código ni su hash. De él solo se sabe cuándo se creó y
   * cuándo se usó por última vez.
   */
  creadas: oc.output(
    z.array(
      z.object({
        perfil_id: z.uuid(),
        nombre_visible: z.string(),
        tipo: z.string(),
        creado_at: z.string(),
        usado_at: z.string().nullable(),
      }),
    ),
  ),

  /** Cuando alguien pierde el papel, o se lo quitan. */
  regenerar: oc
    .errors(errores)
    .input(z.object({ perfil_id: z.uuid() }))
    .output(z.object({ codigo: z.string() })),

  // ─────────────────────────────────────────────────────────────────────
  // La cuenta propia (ADR 0015).
  //
  // Se llaman `abrir` y `guardarMia` y no `crear` y `guardar` porque en este
  // archivo `crear` ya significa otra cosa: la cuenta que un admin abre para
  // otra persona. Dos verbos parecidos con permisos distintos es como se
  // llama al que no toca.
  // ─────────────────────────────────────────────────────────────────────

  /**
   * El perfil de quien está en sesión, o null si todavía no lo ha abierto.
   *
   * Existe porque tres pantallas hacían `supabase.from('perfiles')` por su
   * cuenta para saber lo mismo, y ninguna de las tres serviría desde Expo.
   */
  mia: oc.output(
    z
      .object({
        nombre_visible: z.string(),
        municipios: z.array(z.string()),
        /**
         * ⚠ La columna se llama `contacto_publico` y para un `vecino` es
         * PRIVADA: ninguna vista la lee. Solo se publica cuando el tipo es
         * `servidor`. El nombre de la columna no se cambió —sería una
         * migración con regeneración de tipos y ninguna ganancia— pero la
         * pantalla tiene que decir la verdad, no repetir el nombre.
         */
        contacto_publico: z.string().nullable(),
        contacto_tipo: z.enum(['whatsapp', 'telefono']),
        descripcion: z.string().nullable(),
        tipo: z.enum(['vecino', 'servidor', 'aliado']),
        acepto_publicacion: z.boolean(),
        creado_at: z.string(),
      })
      .nullable(),
  ),

  /**
   * Abrir la cuenta propia. Dos campos, y ni uno más (ADR 0015).
   *
   * ⚠ No lleva teléfono, no lleva tipo y **no lleva casilla de
   * autorización**. Quien abre una cuenta no publica nada todavía, así que no
   * hay finalidad que autorizar (Ley 1581, art. 9). La autorización aparece
   * donde aparece la publicación: al armar el carné, al declarar una
   * matrícula, al publicar en el muro.
   */
  abrir: oc
    .errors(errores)
    .input(
      z.object({
        nombre_visible: z.string().trim().min(3).max(60),
        municipios: z.array(z.string().regex(/^[0-9]{5}$/)).min(1).max(TOPE_MUNICIPIOS),
      }),
    )
    .output(z.object({ ok: z.literal(true) })),

  /**
   * Editar los datos de la cuenta propia, desde «Mis datos y contacto».
   *
   * ⚠ NO toca `tipo`, `acepto_publicacion` ni `autorizacion_version`. Pasar de
   * vecino a prestador o a profesional es dar una autorización de publicación,
   * y eso es otro acto: tiene su pantalla, su versión y su fecha.
   */
  guardarMia: oc
    .errors(errores)
    .input(
      z.object({
        nombre_visible: z.string().trim().min(3).max(60),
        municipios: z.array(z.string().regex(/^[0-9]{5}$/)).min(1).max(TOPE_MUNICIPIOS),
        contacto_publico: z.string().trim().min(7).max(40).nullable().optional(),
        contacto_tipo: z.enum(['whatsapp', 'telefono']).optional(),
        descripcion: z.string().trim().max(300).nullable().optional(),
      }),
    )
    .output(z.object({ ok: z.literal(true) })),
}
