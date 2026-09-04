import 'server-only'

import dns from 'node:dns'
import { Socket, type LookupFunction } from 'node:net'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

import * as esquema from './esquema'

// El pooler de Supabase falla la resolución de nombre de forma intermitente
// —`ENOTFOUND` en una petición y bien en la siguiente—, y cuando pasa el error
// que se ve arriba es «Failed query: select ...», que manda a depurar la
// consulta equivocada. Ya costó una tarde.
//
// El reintento va aquí, en el socket, porque `pg` no acepta un `lookup` propio
// pero sí una fábrica de `stream`. No es solo de desarrollo: un fallo de DNS a
// mitad de una petición es un 500 para quien está buscando a una modista, y la
// consulta que iba a hacerse era perfectamente válida.
const lookupConReintento: LookupFunction = (hostname, opciones, callback) => {
  let intentos = 0
  const probar = () => {
    dns.lookup(hostname, opciones as dns.LookupOneOptions, (err, address, family) => {
      if (!err || intentos >= 3) {
        ;(callback as (e: NodeJS.ErrnoException | null, a: string, f: number) => void)(
          err,
          address,
          family,
        )
        return
      }
      intentos++
      setTimeout(probar, 120 * intentos)
    })
  }
  probar()
}

/** Un socket normal, con la única diferencia de que reintenta el DNS. */
function socketResistente(): Socket {
  const socket = new Socket()
  const conectar = socket.connect.bind(socket)
  // `pg` llama `stream.connect(port, host)`; se le añade el `lookup` por el
  // camino, que es la forma de opciones que sí lo acepta.
  socket.connect = ((...args: unknown[]) => {
    const [puerto, anfitrion] = args as [number, string]
    if (typeof puerto === 'number' && typeof anfitrion === 'string') {
      return conectar({ port: puerto, host: anfitrion, lookup: lookupConReintento })
    }
    return (conectar as (...a: unknown[]) => Socket)(...args)
  }) as Socket['connect']
  return socket
}

// El acceso a Postgres del runtime. Regla 3 de arquitectura del ADR 0001:
// ningún acceso a datos desde el navegador. `server-only` lo hace un error de
// compilación y no una convención que alguien recuerde.
//
// El pool vive en el ámbito del módulo a propósito. Fluid Compute reutiliza la
// instancia de la función entre peticiones concurrentes, así que un pool por
// módulo se reaprovecha; uno por petición abriría una conexión nueva cada vez
// y agotaría el pooler de Supabase con nada de tráfico.

declare global {
  var __poolAquive: Pool | undefined
}

function cadena(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'Falta DATABASE_URL. Es la cadena del pooler de Supabase en modo transaction (puerto 6543), no la conexión directa.',
    )
  }
  return url
}

// En desarrollo, Next recarga los módulos en cada cambio. Sin guardarlo en
// `globalThis`, cada recarga deja atrás un pool con sus conexiones abiertas y
// a los pocos guardados el pooler responde «too many clients».
const pool =
  globalThis.__poolAquive ??
  new Pool({
    connectionString: cadena(),
    // El pooler de Supabase en modo transaction no soporta sentencias
    // preparadas entre peticiones: cada consulta puede caer en otra conexión
    // del lado del servidor.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    stream: socketResistente,
  })

if (process.env.NODE_ENV !== 'production') globalThis.__poolAquive = pool

export const db = drizzle(pool, { schema: esquema, casing: 'snake_case' })

export type BaseDeDatos = typeof db
