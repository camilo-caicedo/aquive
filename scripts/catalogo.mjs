// Lo que comparten `afinar-esquema.mjs` y `verificar-esquema.mjs`: leer el
// catálogo de Postgres y leer qué declara el archivo generado.

import { readFileSync } from 'node:fs'
import pg from 'pg'

export const ARCHIVO = 'src/db/generado/schema.ts'
export const RELACIONES = 'src/db/generado/relations.ts'

/** snake_case tal como lo deriva Drizzle de un identificador de TypeScript. */
export function aSnake(nombre) {
  return nombre.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

function credenciales() {
  return Object.fromEntries(
    readFileSync('.env.migracion', 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
      .filter((m) => m !== null)
      .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
  )
}

/**
 * El catálogo real de la base de PRUEBAS, en solo lectura.
 * Devuelve `Map<tabla, Map<columna, { esArreglo }>>`.
 */
export async function leerCatalogo() {
  const env = credenciales()
  if (!env.DB_URL_TEST) throw new Error('Falta DB_URL_TEST en .env.migracion.')

  let cliente
  let ultimo
  // El DNS del pooler falla de vez en cuando desde una máquina de desarrollo.
  // Reintentar es más barato que hacer creer que el esquema está mal.
  for (let i = 0; i < 4; i++) {
    cliente = new pg.Client({
      connectionString: env.DB_URL_TEST,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20_000,
    })
    try {
      await cliente.connect()
      ultimo = null
      break
    } catch (e) {
      ultimo = e
      cliente = null
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  if (!cliente) throw ultimo

  const { rows } = await cliente.query(
    `select table_name, column_name, data_type
       from information_schema.columns
      where table_schema = 'public'`,
  )
  await cliente.end()

  const catalogo = new Map()
  for (const r of rows) {
    if (!catalogo.has(r.table_name)) catalogo.set(r.table_name, new Map())
    catalogo.get(r.table_name).set(r.column_name, { esArreglo: r.data_type === 'ARRAY' })
  }
  return catalogo
}

/**
 * Qué declara el archivo generado, bloque por bloque.
 * Devuelve `Map<objeto, { tipo, columnas: Map<nombreEnBase, {clave, explicito, esArreglo}> }>`.
 */
export function leerGenerado(fuente = readFileSync(ARCHIVO, 'utf8')) {
  const mapa = new Map()

  for (const parte of fuente.split(/^export const /m).slice(1)) {
    const cab = parte.match(/^(\w+) = (pgTable|pgView)\("([a-z_0-9]+)"/)
    if (!cab) continue

    const columnas = new Map()

    // Por líneas y no con una expresión sobre el bloque entero: una columna
    // puede venir como `creadoAt: timestamp("creado_at", { mode: 'string' })`
    // o como `cantidad: numeric({ precision: 8, scale: 2 })`, y una expresión
    // que exija el paréntesis pegado al nombre se salta justo esas.
    //
    // Antes hay que normalizar: la primera columna va en la MISMA línea que
    // la cabecera (`pgTable("x", {\tid: uuid(),`), así que se le mete un
    // salto detrás de la llave que abre el objeto de columnas. Solo esa: la
    // llave de un `{ mode: 'string' }` no abre columnas y no se toca.
    const cuerpo = parte.replace(
      /^(\w+ = (?:pgTable|pgView)\("[a-z_0-9]+",\s*\{)/,
      '$1\n',
    )

    for (const linea of cuerpo.split('\n')) {
      const m = linea.match(/^\s*(\w+): (\w+)\((.*)$/)
      if (!m) continue

      const [, clave, , resto] = m
      const explicitoM = resto.match(/^"([a-z_0-9]+)"/)
      const nombre = explicitoM ? explicitoM[1] : aSnake(clave)
      if (nombre === cab[3]) continue // la cabecera del propio objeto

      columnas.set(nombre, {
        clave,
        explicito: Boolean(explicitoM),
        esArreglo: /\.array\(/.test(resto),
      })
    }

    mapa.set(cab[3], { tipo: cab[2], columnas })
  }
  return mapa
}
