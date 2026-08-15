// Reescribe el bloque de `solicitudes_publicas` dentro de
// `v2-k1-nota-admin.sql` A PARTIR de la vista que hay en la base, añadiendo
// solo `nota_admin` al final.
//
// La vista la lee `anon` y es el tablero entero: reescribirla de memoria es
// arriesgarse a que una columna cambie de nombre o desaparezca sin que se
// note hasta que alguien abre la portada.
import { readFileSync, writeFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env.migracion', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')])
)

const c = new pg.Client({ connectionString: env.DB_URL_PROD, ssl: { rejectUnauthorized: false } })
await c.connect()
const { rows } = await c.query(
  `select pg_get_viewdef('public.solicitudes_publicas'::regclass, true) as def`
)
await c.end()

const def = rows[0].def.trim().replace(/;$/, '')

if (def.includes('nota_admin')) {
  console.error('La vista ya tiene nota_admin. Sin tocar nada.')
  process.exit(1)
}

// `s.flujo` es hoy la última columna del select. La nota va detrás: `create
// or replace view` solo admite añadir al final.
if (!/s\.flujo\s*\n\s*FROM/i.test(def)) {
  console.error('No encontré `s.flujo` como última columna; la vista cambió. Sin tocar nada.')
  process.exit(1)
}

const conNota = def.replace(
  /s\.flujo(\s*\n\s*FROM)/i,
  's.flujo,\n    -- Texto del proyecto, no de quien pidió. Se escribe para ser leído aquí.\n    s.nota_admin$1'
)

const archivo = 'supabase/migraciones/v2-k1-nota-admin.sql'
const sql = readFileSync(archivo, 'utf8')

const inicio = sql.indexOf('create or replace view public.solicitudes_publicas as')
const fin = sql.indexOf('grant select on public.solicitudes_publicas to anon, authenticated;')
if (inicio === -1 || fin === -1) {
  console.error('No encontré el bloque de la vista en la migración.')
  process.exit(1)
}

const nuevo =
  sql.slice(0, inicio) +
  'create or replace view public.solicitudes_publicas as\n' +
  conNota +
  ';\n\n' +
  sql.slice(fin)

writeFileSync(archivo, nuevo)
console.log('bloque de la vista reemplazado por la definición real + nota_admin')
