// Comprueba que los tipos generados describen la base de verdad.
//
// `tsc` no puede hacer esto: el archivo generado compila igual de bien diga
// `p256dh` o `p256_dh`, y la diferencia solo aparece cuando Postgres responde
// «column does not exist» con tráfico real.
//
// Y esa no es una posibilidad teórica: la primera introspección escribió
// `p256Dh: text()` sin nombre explícito. Con `casing: 'snake_case'`, Drizzle
// deriva `p256_dh` del nombre en TypeScript, y la columna real es `p256dh`.
// Habría reventado en el envío de avisos push, en producción, sin que ninguna
// comprobación de tipos dijera nada.
//
// Corre contra la base de PRUEBAS, en solo lectura.

import { readFileSync } from 'node:fs'
import pg from 'pg'

const ARCHIVO = 'src/db/generado/schema.ts'

function credenciales() {
  return Object.fromEntries(
    readFileSync('.env.migracion', 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
      .filter((m) => m !== null)
      .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
  )
}

/** snake_case tal como lo deriva Drizzle de un identificador de TypeScript. */
function aSnake(nombre) {
  return nombre.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

/** Lee del archivo generado qué objetos y columnas declara. */
function declarado() {
  const fuente = readFileSync(ARCHIVO, 'utf8')
  const mapa = new Map()

  for (const parte of fuente.split(/^export const /m).slice(1)) {
    const cab = parte.match(/^(\w+) = (pgTable|pgView)\("([a-z_0-9]+)"/)
    if (!cab) continue

    const columnas = new Map() // nombre en la base -> clave en TypeScript
    // `nombre: tipo("columna_real")` — nombre explícito, siempre correcto.
    for (const m of parte.matchAll(/(\w+): \w+\("([a-z_0-9]+)"/g)) {
      if (m[2] === cab[3]) continue // la cabecera del propio pgTable/pgView
      columnas.set(m[2], m[1])
    }
    // `nombre: tipo()` o `nombre: tipo({...})` — SIN nombre explícito. Aquí es
    // donde se cuelan los desajustes: el nombre real lo deriva el `casing`.
    for (const m of parte.matchAll(/(\w+): \w+\((?:\{|\))/g)) {
      const derivado = aSnake(m[1])
      if (!columnas.has(derivado)) columnas.set(derivado, m[1])
    }
    mapa.set(cab[3], columnas)
  }
  return mapa
}

async function conectar(url, intentos = 4) {
  let ultimo
  for (let i = 1; i <= intentos; i++) {
    const c = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20_000,
    })
    try {
      await c.connect()
      return c
    } catch (e) {
      // El DNS del pooler falla de vez en cuando desde aquí. Reintentar es
      // más barato que hacer creer que el esquema está mal.
      ultimo = e
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  throw ultimo
}

const env = credenciales()
if (!env.DB_URL_TEST) {
  console.error('verificar-esquema: falta DB_URL_TEST en .env.migracion.')
  process.exit(1)
}

const cliente = await conectar(env.DB_URL_TEST)
const { rows } = await cliente.query(
  `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
)
await cliente.end()

const real = new Map()
for (const r of rows) {
  if (!real.has(r.table_name)) real.set(r.table_name, new Set())
  real.get(r.table_name).add(r.column_name)
}

const decl = declarado()
const problemas = []

for (const tabla of real.keys()) {
  if (!decl.has(tabla)) problemas.push(`falta en los tipos: ${tabla}`)
}
for (const [tabla, columnas] of decl) {
  const enBase = real.get(tabla)
  if (!enBase) {
    problemas.push(`sobra en los tipos (no está en la base): ${tabla}`)
    continue
  }
  for (const columna of enBase) {
    if (!columnas.has(columna)) problemas.push(`columna sin tipar: ${tabla}.${columna}`)
  }
  for (const [columna, clave] of columnas) {
    if (!enBase.has(columna)) {
      problemas.push(
        `columna que no existe en la base: ${tabla}.${columna} (declarada como \`${clave}\`)`,
      )
    }
  }
}

if (problemas.length > 0) {
  console.error(`verificar-esquema: ${problemas.length} desajustes entre los tipos y la base:`)
  for (const p of problemas) console.error('  · ' + p)
  console.error('\nSi la base cambió, corre `npm run db:pull`. Si el desajuste lo')
  console.error('introduce la introspección, arréglalo en scripts/afinar-esquema.mjs')
  console.error('para que sobreviva al próximo pull.')
  process.exit(1)
}

console.log(
  `verificar-esquema: ${decl.size} objetos y ${rows.length} columnas coinciden con la base de pruebas.`,
)

// Autocomprobación de la derivación, que es de donde salió el bug.
console.assert(aSnake('p256Dh') === 'p256_dh', 'aSnake mal')
console.assert(aSnake('solicitudId') === 'solicitud_id', 'aSnake mal')
console.assert(aSnake('endpoint') === 'endpoint', 'aSnake mal')
