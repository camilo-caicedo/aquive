// Arregla lo que `drizzle-kit pull` no puede resolver solo. Corre después del
// pull (ver el script `db:pull` de package.json), porque el pull reescribe
// `src/db/generado/` entero y se lleva por delante cualquier edición a mano.
//
// Son tres cosas, las tres mecánicas:
//
//   1. `bytea` sale como `unknown()`, que ni siquiera compila. Son las cinco
//      columnas de PII cifrada.
//   2. Las llaves foráneas hacia `auth.users` salen apuntando a un `users` que
//      no existe, porque `schemaFilter` deja fuera el esquema `auth` a
//      propósito.
//   3. `p256dh` sale como `p256Dh` sin nombre explícito, y con
//      `casing: 'snake_case'` eso consulta `p256_dh`, que no existe.
//
// Es sustitución de texto sobre un archivo generado por una herramienta, así
// que es frágil por naturaleza: si el pull cambia de forma, esto falla RUIDOSO
// en vez de dejar el archivo a medias. De ahí que cuente y verifique.

import { readFileSync, writeFileSync } from 'node:fs'

const ARCHIVO = 'src/db/generado/schema.ts'
const RELACIONES = 'src/db/generado/relations.ts'

function afinar(fuente) {
  let salida = fuente
  const cuenta = { bytea: 0, users: 0, nombres: 0 }

  // 1. bytea
  salida = salida.replace(/\/\/ TODO: failed to parse database type 'bytea'\r?\n\s*/g, '')
  salida = salida.replace(/\bunknown\(/g, () => {
    cuenta.bytea++
    return 'bytea('
  })

  // 2. auth.users
  salida = salida.replace(/foreignColumns: \[users\.id\]/g, () => {
    cuenta.users++
    return 'foreignColumns: [usersInAuth.id]'
  })

  // 3. Columnas cuyo nombre no sobrevive el viaje de ida y vuelta por
  //    `casing: 'snake_case'`.
  //
  //    La base tiene `p256dh`. Drizzle lo escribe como `p256Dh` SIN nombre
  //    explícito, así que en tiempo de ejecución la consulta pide `p256_dh`
  //    y Postgres responde que esa columna no existe. Es de las peores:
  //    compila perfecto y revienta con tráfico real, en el envío de avisos.
  //
  //    `verificar-esquema.mjs` comprueba después que no quedó ninguna otra.
  salida = salida.replace(/\bp256Dh: text\(\)/g, () => {
    cuenta.nombres++
    return 'p256Dh: text("p256dh")'
  })

  // El import va después de la última línea de imports que ya trae el archivo.
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

function afinarRelaciones(fuente) {
  // `relations.ts` importa `usersInAuth` de `./schema`, que ya no lo exporta
  // —lo declaramos nosotros en `../tipos`—. Pero SÍ lo usa, así que no se
  // borra: se saca de ese import y se trae del sitio correcto.
  if (!/from "\.\/schema"/.test(fuente)) return { salida: fuente, arreglado: false }

  let salida = fuente.replace(
    /^(import \{([^}]*)\} from "\.\/schema";?)$/m,
    (linea, _todo, nombres) => {
      const limpios = nombres
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n && n !== 'usersInAuth')
      return `import { ${limpios.join(', ')} } from "./schema";\nimport { usersInAuth } from "../tipos";`
    },
  )

  // Si el import ya venía sin `usersInAuth`, no dupliques el nuestro.
  if ((salida.match(/from "\.\.\/tipos"/g) ?? []).length > 1) salida = fuente

  const arreglado = salida !== fuente
  return { salida, arreglado }
}

const { salida, cuenta } = afinar(readFileSync(ARCHIVO, 'utf8'))

if (cuenta.bytea === 0 && cuenta.users === 0 && cuenta.nombres === 0) {
  console.log('afinar-esquema: nada que arreglar (¿cambió la salida de drizzle-kit?)')
} else {
  writeFileSync(ARCHIVO, salida)
  console.log(`afinar-esquema: ${cuenta.bytea} columnas bytea, ${cuenta.users} llaves hacia auth.users, ${cuenta.nombres} nombres de columna fijados`)
}

if (salida.includes('unknown(')) {
  console.error('afinar-esquema: quedaron unknown() sin resolver. Míralos antes de seguir.')
  process.exit(1)
}

const rel = afinarRelaciones(readFileSync(RELACIONES, 'utf8'))
if (rel.arreglado) {
  writeFileSync(RELACIONES, rel.salida)
  console.log('afinar-esquema: quitado usersInAuth del import de relations.ts')
}

// Comprobación mínima: que las dos sustituciones hacen lo que dicen.
// Sin marco de pruebas a propósito — es un script, no una librería.
{
  const antes = [
    'import { sql } from "drizzle-orm";',
    "\t// TODO: failed to parse database type 'bytea'",
    '\tnombreCifrado: unknown("nombre_cifrado").notNull(),',
    '\t\t\tforeignColumns: [users.id],',
    '\tp256Dh: text().notNull(),',
  ].join('\n')
  const { salida: despues, cuenta: c } = afinar(antes)
  const ok =
    c.bytea === 1 &&
    c.users === 1 &&
    c.nombres === 1 &&
    despues.includes('bytea("nombre_cifrado")') &&
    despues.includes('[usersInAuth.id]') &&
    despues.includes('p256Dh: text("p256dh")') &&
    despues.includes('from "../tipos"') &&
    !despues.includes('failed to parse')
  if (!ok) {
    console.error('afinar-esquema: la autocomprobación falló.\n' + despues)
    process.exit(1)
  }
}
