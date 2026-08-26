import { readFileSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// Paso 1 del ADR 0001: sacar los tipos del esquema que YA existe, sin tocarlo.
//
// `drizzle-kit pull` es de solo lectura: lee el catálogo de Postgres y
// escribe `src/db/esquema.ts`. No genera migraciones ni aplica nada, así que
// no puede romper una base con datos de personas.
//
// Por eso mismo apunta a **test** y no a producción. La estructura de las dos
// es la misma —`migracion/aplicar.mjs` corre los mismos archivos contra las
// dos—, así que los tipos salen idénticos y no hay motivo para abrir una
// conexión contra la base real solo para leer nombres de columnas.
//
// La cadena de conexión sale de `.env.migracion`, que es donde ya vivía para
// los scripts de migración. No se copia a `.env.local`: ahí van las variables
// que necesita la aplicación en ejecución, y esta no es una de ellas — el
// runtime habla con Postgres por el pool de `src/db/cliente.ts`, con su
// propia variable.
function cadenaDePruebas(): string {
  const env = Object.fromEntries(
    readFileSync('.env.migracion', 'utf8')
      .split(/\r?\n/)
      .map((linea) => linea.match(/^([A-Z_]+)=(.*)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      // Los valores van entre comillas en el archivo. Sin quitarlas, la
      // cadena no parsea como URL y el error que sale es un ENOTFOUND del
      // host `base`, que no ayuda a nadie.
      .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
  )

  const url = env.DB_URL_TEST
  if (!url) {
    throw new Error(
      'Falta DB_URL_TEST en .env.migracion. Es la base de PRUEBAS: no pongas aquí la de producción.',
    )
  }
  return url
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/generado/schema.ts',
  // Drizzle NO es dueño de las migraciones. El esquema lo manda
  // `supabase/migraciones/`, que se aplica con `migracion/aplicar.mjs`.
  // Aquí solo caen los tipos generados; el `0000_*.sql` y `meta/` que
  // `pull` escribe al lado están en .gitignore a propósito.
  out: './src/db/generado',
  // El pooler de Supabase exige TLS y presenta un certificado que la cadena
  // de confianza de Node no trae. Aquí eso es aceptable —es introspección de
  // solo lectura contra la base de pruebas, desde la máquina de quien
  // desarrolla—. El pool del runtime (`src/db/cliente.ts`) NO debe copiar
  // esto: allí va el certificado de Supabase de verdad.
  dbCredentials: { url: cadenaDePruebas(), ssl: { rejectUnauthorized: false } },
  // Solo el esquema de la aplicación. `auth`, `storage`, `vault` y demás son
  // de Supabase: introspectarlos metería en el repo tipos de tablas que no
  // son nuestras y que cambian cuando el proveedor quiera.
  schemaFilter: ['public'],
  casing: 'snake_case',
  verbose: true,
  strict: true,
})
