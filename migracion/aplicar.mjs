// Aplica los archivos de `supabase/migraciones/` contra una base, leyendo
// cada uno DEL DISCO. No pasa por ningun copiado a mano: es la diferencia
// entre migrar y transcribir, y aqui dentro hay funciones security definer
// que cifran documentos de identidad.
//
//   node migracion/aplicar.mjs test  v2-d1-organizaciones.sql [...]
//   node migracion/aplicar.mjs prod  v2-d1-organizaciones.sql [...]
//
// Sin nombres de archivo, solo dice a que base apunta y se va. Nunca
// imprime la cadena de conexion.
//
// Cada archivo va en su propia transaccion: si uno falla, ese queda entero
// sin aplicar y los anteriores se quedan. Se corrige y se vuelve a correr
// desde el que fallo — todos son idempotentes.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const entorno = process.argv[2]
const archivos = process.argv.slice(3)

if (entorno !== 'test' && entorno !== 'prod') {
  console.error('Uso: node migracion/aplicar.mjs <test|prod> [archivo.sql ...]')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync('.env.migracion', 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')])
)

const url = entorno === 'prod' ? env.DB_URL_PROD : env.DB_URL_TEST
if (!url) {
  console.error(`Falta ${entorno === 'prod' ? 'DB_URL_PROD' : 'DB_URL_TEST'} en .env.migracion`)
  process.exit(1)
}

const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await cliente.connect()

// La comprobacion de la regla 1: produccion tiene 5 perfiles. Se imprime
// SIEMPRE, aunque no haya archivos que aplicar, para no equivocarse de base.
const { rows } = await cliente.query(
  'select current_database() as bd, (select count(*) from public.perfiles) as perfiles'
)
console.log(`conectado a ${entorno} · base ${rows[0].bd} · ${rows[0].perfiles} perfiles`)

if (archivos.length === 0) {
  await cliente.end()
  process.exit(0)
}

for (const nombre of archivos) {
  const sql = readFileSync(`supabase/migraciones/${nombre}`, 'utf8')
  process.stdout.write(`  ${nombre} (${Math.round(sql.length / 1024)} KB) … `)
  try {
    await cliente.query('begin')
    await cliente.query(sql)
    await cliente.query('commit')
    console.log('ok')
  } catch (e) {
    await cliente.query('rollback')
    console.log('FALLO')
    console.error(`     ${e.message}`)
    if (e.hint) console.error(`     pista: ${e.hint}`)
    await cliente.end()
    process.exit(1)
  }
}

await cliente.end()
