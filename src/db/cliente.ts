import 'server-only'

import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

import * as esquema from './esquema'

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
  })

if (process.env.NODE_ENV !== 'production') globalThis.__poolAquive = pool

export const db = drizzle(pool, { schema: esquema, casing: 'snake_case' })

export type BaseDeDatos = typeof db
