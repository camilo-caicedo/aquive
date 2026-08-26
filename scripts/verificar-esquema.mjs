// Comprueba que los tipos generados describen la base de verdad.
//
// `tsc` no puede hacer esto: el archivo generado compila igual diga `p256dh`
// o `p256_dh`, y diga `text()` o `text().array()`. La diferencia solo aparece
// cuando Postgres responde «column does not exist», o cuando un `.map()`
// revienta sobre lo que se creía un arreglo.
//
// No es teórico: la primera introspección escribió `p256Dh: text()` sin
// nombre explícito, y con `casing: 'snake_case'` eso consulta `p256_dh`.
// Habría reventado en el envío de avisos push, en producción, sin que ninguna
// comprobación de tipos dijera nada.
//
// Corre contra la base de PRUEBAS, en solo lectura.

import { leerCatalogo, leerGenerado } from './catalogo.mjs'

const catalogo = await leerCatalogo()
const declarado = leerGenerado()
const problemas = []

for (const objeto of catalogo.keys()) {
  if (!declarado.has(objeto)) problemas.push(`falta en los tipos: ${objeto}`)
}

let columnas = 0
for (const [objeto, { columnas: cols }] of declarado) {
  const real = catalogo.get(objeto)
  if (!real) {
    problemas.push(`sobra en los tipos (no está en la base): ${objeto}`)
    continue
  }
  for (const columna of real.keys()) {
    if (!cols.has(columna)) problemas.push(`columna sin tipar: ${objeto}.${columna}`)
  }
  for (const [columna, info] of cols) {
    const enBase = real.get(columna)
    if (!enBase) {
      problemas.push(
        `columna que no existe en la base: ${objeto}.${columna} (declarada como \`${info.clave}\`)`,
      )
      continue
    }
    if (enBase.esArreglo !== info.esArreglo) {
      problemas.push(
        enBase.esArreglo
          ? `es arreglo en la base pero no en los tipos: ${objeto}.${columna}`
          : `es arreglo en los tipos pero no en la base: ${objeto}.${columna}`,
      )
    }
    columnas++
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
  `verificar-esquema: ${declarado.size} objetos y ${columnas} columnas coinciden con la base de pruebas.`,
)
