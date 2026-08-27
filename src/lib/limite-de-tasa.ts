import 'server-only'

/**
 * El límite de tasa de la API. `CLAUDE.md`, tabla de arquitectura:
 * «Anti-abuso | Turnstile en web; **límite de tasa en la API**».
 *
 * No existía. Turnstile solo cubre dos formularios, y el endpoint de oRPC
 * —que es uno solo, `/api/rpc`— no tenía ninguno: cualquiera podía repetir
 * una escritura tantas veces como quisiera.
 *
 * ⚠ Ventana deslizante en memoria del proceso, a propósito, y con dos
 * consecuencias que hay que tener escritas:
 *
 * 1. **No se comparte entre instancias.** En Vercel cada función tiene la
 *    suya, así que el techo real es el que hay aquí multiplicado por cuántas
 *    haya vivas. Para lo que esto frena —alguien repitiendo un formulario a
 *    mano o con un script casero— sobra. Para un ataque repartido no sirve,
 *    y ahí el freno es otro: la cuenta obligatoria del ADR 0006.
 * 2. **Se pierde al reiniciar.** Es un techo, no una sanción; olvidarlo no
 *    deja a nadie fuera, solo le devuelve su cuota.
 *
 * La alternativa sería una tabla en Postgres o un Redis. Una escritura de
 * base por cada lectura de la API es cara para lo que se gana, y un Redis es
 * una pieza de infraestructura más en un proyecto que no tiene ninguna
 * (regla de estilo: sin librerías nuevas por comodidad). Cuando el techo de
 * arriba estorbe de verdad, esto se cambia por lo que haga falta y el resto
 * del código no se entera: la única puerta es `permitir()`.
 */

/** Cuántas veces, en cuánto tiempo. */
export interface Cupo {
  veces: number
  ventanaMs: number
}

/**
 * Lo que se le deja hacer a quien NO tiene cuenta.
 *
 * Es apretado porque lo que puede hacer sin cuenta es poco y ninguno de esos
 * pocos es una acción que se repita: escribir una PQR, reportar contenido.
 */
export const SIN_CUENTA: Cupo = { veces: 20, ventanaMs: 60_000 }

/**
 * Con cuenta. Más ancho porque navegar la aplicación son muchas lecturas
 * seguidas —el directorio, los filtros, la bandeja— y ninguna es sospechosa.
 */
export const CON_CUENTA: Cupo = { veces: 240, ventanaMs: 60_000 }

/**
 * Escrituras que crean algo, con cuenta o sin ella.
 *
 * Publicar, responder, subir una imagen. Nadie publica cuarenta cosas en un
 * minuto a mano, y es justo lo que hace quien está llenando el sitio de
 * basura.
 */
export const ESCRITURA: Cupo = { veces: 12, ventanaMs: 60_000 }

/** Las marcas de tiempo de cada llave, lo más nuevo al final. */
const golpes = new Map<string, number[]>()

/**
 * Se limpia cada tantas comprobaciones, no con un temporizador.
 *
 * Un `setInterval` en un proceso de Vercel mantiene vivo el trabajo entre
 * peticiones; esto solo cuesta cuando ya se está haciendo algo.
 */
let desdeLaUltimaLimpieza = 0
const CADA = 500

function limpiar(ahora: number) {
  for (const [llave, marcas] of golpes) {
    // Una hora sin tocarse: nadie va a echar de menos su cuenta.
    if (marcas.length === 0 || ahora - marcas[marcas.length - 1] > 3_600_000) {
      golpes.delete(llave)
    }
  }
}

/**
 * ¿Cabe una más?
 *
 * Devuelve `false` cuando ya se pasó, y en ese caso NO cuenta el intento:
 * quien está bloqueado no se bloquea más por seguir intentando, que es lo
 * que convierte un techo en un castigo.
 */
export function permitir(llave: string, cupo: Cupo): boolean {
  const ahora = Date.now()

  if (++desdeLaUltimaLimpieza >= CADA) {
    desdeLaUltimaLimpieza = 0
    limpiar(ahora)
  }

  const desde = ahora - cupo.ventanaMs
  const marcas = (golpes.get(llave) ?? []).filter((m) => m > desde)

  if (marcas.length >= cupo.veces) {
    golpes.set(llave, marcas)
    return false
  }

  marcas.push(ahora)
  golpes.set(llave, marcas)
  return true
}

/**
 * De quién es esta petición, para contarle a él y no a todo el mundo.
 *
 * Con sesión, el id de la cuenta: es lo más preciso y no depende de la red.
 * Sin ella, la IP que dice el proxy de delante.
 *
 * ⚠ Nada de esto se escribe en ningún registro (regla de producto 9). La IP
 * vive en esta tabla en memoria, como clave, y se va con ella.
 */
export function quien(peticion: Request, usuarioId: string | null): string {
  if (usuarioId) return `u:${usuarioId}`
  const reenviada = peticion.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return `ip:${reenviada || peticion.headers.get('x-real-ip') || 'desconocida'}`
}
