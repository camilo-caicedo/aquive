// Arregla lo que `drizzle-kit pull` no resuelve solo. Corre después del pull
// (ver el script `db:pull` de package.json), porque el pull reescribe
// `src/db/generado/` entero y se lleva por delante cualquier edición a mano.
//
// Son cuatro cosas. Las dos primeras son de tipo y se arreglan con texto; las
// dos últimas son de NOMBRE y de FORMA, y esas se arreglan **preguntándole al
// catálogo de Postgres**, no con una lista escrita a mano que se queda vieja:
//
//   1. `bytea` sale como `unknown()`, que ni siquiera compila. Son las cinco
//      columnas de PII cifrada de `identidades` y `referencias`.
//   2. Quince llaves foráneas apuntan a un `users` que no existe, porque
//      `schemaFilter` deja fuera el esquema `auth` a propósito.
//   3. Columnas sin nombre explícito cuyo nombre real no coincide con lo que
//      `casing: 'snake_case'` deriva. `p256dh` salía como `p256Dh: text()`, y
//      eso consulta `p256_dh`: compila perfecto y revienta al mandar avisos.
//   4. Columnas de arreglo **en las vistas**: drizzle les pone `.array()` en
//      las tablas pero lo pierde en las vistas, así que `modalidad`, `dias`,
//      `franjas` y compañía quedan tipadas como `string` cuando en ejecución
//      llega un `string[]`.
//
// Falla RUIDOSO si algo no encaja, en vez de dejar el archivo a medias.

import { readFileSync, writeFileSync } from 'node:fs'

import { ARCHIVO, RELACIONES, aSnake, leerCatalogo, leerGenerado } from './catalogo.mjs'

/** 1 y 2: sustituciones de tipo, sin necesidad de base. */
function afinarTipos(fuente) {
  let salida = fuente
  const cuenta = { bytea: 0, users: 0 }

  salida = salida.replace(/\/\/ TODO: failed to parse database type 'bytea'\r?\n\s*/g, '')
  salida = salida.replace(/\bunknown\(/g, () => {
    cuenta.bytea++
    return 'bytea('
  })
  salida = salida.replace(/foreignColumns: \[users\.id\]/g, () => {
    cuenta.users++
    return 'foreignColumns: [usersInAuth.id]'
  })

  if (cuenta.bytea > 0 || cuenta.users > 0) {
    const necesarios = [
      cuenta.bytea > 0 ? 'bytea' : null,
      cuenta.users > 0 ? 'usersInAuth' : null,
    ].filter(Boolean)
    salida = salida.replace(
      /^(import .+ from "drizzle-orm";?)$/m,
      `$1\nimport { ${necesarios.join(', ')} } from "../tipos";`,
    )
  }
  return { salida, cuenta }
}

/** 3 y 4: nombre y forma, según lo que diga la base. */
function afinarSegunCatalogo(fuente, catalogo) {
  const declarado = leerGenerado(fuente)
  const cuenta = { nombres: 0, arreglos: 0 }
  const sinResolver = []
  let salida = fuente

  for (const [objeto, { columnas }] of declarado) {
    const real = catalogo.get(objeto)
    if (!real) continue

    // Las claves de TypeScript que el archivo ya usa en este objeto, para no
    // inventar un nombre que choque.
    const usadas = new Set([...columnas.values()].map((c) => c.clave))

    for (const [nombreEnBase, info] of columnas) {
      // 3. El nombre derivado no existe en la base.
      if (!info.explicito && !real.has(nombreEnBase)) {
        // ¿Hay una columna real que solo se diferencia en los guiones bajos?
        const candidata = [...real.keys()].find(
          (c) => c.replace(/_/g, '') === aSnake(info.clave).replace(/_/g, ''),
        )
        if (!candidata) {
          sinResolver.push(`${objeto}.${info.clave} (derivaba \`${nombreEnBase}\`)`)
          continue
        }
        const antes = new RegExp(`\\b${info.clave}: (\\w+)\\(\\)`, 'g')
        const despues = salida.replace(antes, (_m, tipo) => `${info.clave}: ${tipo}("${candidata}")`)
        if (despues !== salida) {
          salida = despues
          cuenta.nombres++
        }
        usadas.add(info.clave)
        continue
      }

      // 4. Es arreglo en la base pero no lo dice el tipo.
      const enBase = real.get(nombreEnBase)
      if (enBase?.esArreglo && !info.esArreglo) {
        const antes = info.explicito
          ? new RegExp(`\\b${info.clave}: (\\w+)\\("${nombreEnBase}"\\)(?!\\.array)`, 'g')
          : new RegExp(`\\b${info.clave}: (\\w+)\\(\\)(?!\\.array)`, 'g')
        const despues = salida.replace(antes, (m, tipo) =>
          info.explicito
            ? `${info.clave}: ${tipo}("${nombreEnBase}").array()`
            : `${info.clave}: ${tipo}().array()`,
        )
        if (despues !== salida) {
          salida = despues
          cuenta.arreglos++
        }
      }
    }
  }

  return { salida, cuenta, sinResolver }
}

function afinarRelaciones(fuente) {
  // `relations.ts` importa `usersInAuth` de `./schema`, que ya no lo exporta
  // —lo declaramos en `../tipos`—. Pero SÍ lo usa, así que no se borra: se
  // saca de ese import y se trae del sitio correcto.
  if (!/from "\.\/schema"/.test(fuente)) return { salida: fuente, arreglado: false }
  if (/from "\.\.\/tipos"/.test(fuente)) return { salida: fuente, arreglado: false }

  const salida = fuente.replace(/^(import \{([^}]*)\} from "\.\/schema";?)$/m, (_l, _t, nombres) => {
    const limpios = nombres
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n && n !== 'usersInAuth')
    return `import { ${limpios.join(', ')} } from "./schema";\nimport { usersInAuth } from "../tipos";`
  })
  return { salida, arreglado: salida !== fuente }
}

// --- autocomprobación, antes de tocar nada -----------------------------
{
  const antes = [
    'import { sql } from "drizzle-orm";',
    "\t// TODO: failed to parse database type 'bytea'",
    '\tnombreCifrado: unknown("nombre_cifrado").notNull(),',
    '\t\t\tforeignColumns: [users.id],',
  ].join('\n')
  const { salida, cuenta } = afinarTipos(antes)
  const ok =
    cuenta.bytea === 1 &&
    cuenta.users === 1 &&
    salida.includes('bytea("nombre_cifrado")') &&
    salida.includes('[usersInAuth.id]') &&
    salida.includes('from "../tipos"') &&
    !salida.includes('failed to parse')
  if (!ok) {
    console.error('afinar-esquema: la autocomprobación de tipos falló.\n' + salida)
    process.exit(1)
  }

  const catalogoFalso = new Map([
    [
      't',
      new Map([
        ['p256dh', { esArreglo: false }],
        ['modalidad', { esArreglo: true }],
      ]),
    ],
  ])
  const vista = [
    'export const t = pgTable("t", {',
    '\tp256Dh: text(),',
    '\tmodalidad: text(),',
    '})',
  ].join('\n')
  const r = afinarSegunCatalogo(vista, catalogoFalso)
  if (
    r.cuenta.nombres !== 1 ||
    r.cuenta.arreglos !== 1 ||
    !r.salida.includes('p256Dh: text("p256dh")') ||
    !r.salida.includes('modalidad: text().array()')
  ) {
    console.error('afinar-esquema: la autocomprobación de catálogo falló.\n' + r.salida)
    process.exit(1)
  }
}

// --- trabajo de verdad -------------------------------------------------

const tipos = afinarTipos(readFileSync(ARCHIVO, 'utf8'))
const catalogo = await leerCatalogo()
const segun = afinarSegunCatalogo(tipos.salida, catalogo)

writeFileSync(ARCHIVO, segun.salida)
console.log(
  `afinar-esquema: ${tipos.cuenta.bytea} bytea, ${tipos.cuenta.users} llaves a auth.users, ` +
    `${segun.cuenta.nombres} nombres fijados, ${segun.cuenta.arreglos} arreglos marcados`,
)

const rel = afinarRelaciones(readFileSync(RELACIONES, 'utf8'))
if (rel.arreglado) {
  writeFileSync(RELACIONES, rel.salida)
  console.log('afinar-esquema: usersInAuth reapuntado en relations.ts')
}

if (segun.salida.includes('unknown(')) {
  console.error('afinar-esquema: quedaron unknown() sin resolver.')
  process.exit(1)
}
if (segun.sinResolver.length > 0) {
  console.error('afinar-esquema: columnas cuyo nombre real no se pudo deducir:')
  for (const s of segun.sinResolver) console.error('  · ' + s)
  process.exit(1)
}
