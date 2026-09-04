// Fotos de prueba para los datos de prueba.
//
// Pasa las imágenes por EL MISMO `sharp` que el recorrido de verdad
// —`src/server/imagenes/recorrido.ts`—, no por uno parecido: rotar según el
// EXIF, redimensionar a 1600 por el lado largo y reescribir en WebP. Ese
// reescribir es lo que descarta los metadatos, y una semilla que se los
// saltara estaría sembrando datos que la aplicación nunca produciría.
//
// Deja UNO DE CADA TRES sin foto, a propósito. Es el caso que hay que poder
// mirar: la mitad del rebusque no va a subir una foto nunca, y las pantallas
// tienen que verse bien así.
//
//   node scripts/sembrar-fotos.mjs            siembra lo que falte
//   node scripts/sembrar-fotos.mjs --limpiar  borra lo que sembró
//
// Credenciales: `.env.migracion` para la base (DB_URL_TEST) y `.env.local`
// para el almacén (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import dns from 'node:dns'
import pg from 'pg'
import sharp from 'sharp'

// El DNS del pooler resuelve por IPv6 desde esta máquina y falla. Mismo
// remedio que en `catalogo.mjs`.
dns.setDefaultResultOrder('ipv4first')

const LADO_MAXIMO = 1600
const LIMPIAR = process.argv.includes('--limpiar')

/** La marca que distingue lo sembrado de lo que subió una persona. */
const MOTIVO = 'sembrada por scripts/sembrar-fotos.mjs'

function env(archivo) {
  return Object.fromEntries(
    readFileSync(archivo, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/))
      .filter((m) => m !== null)
      .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
  )
}

const DB = env('.env.migracion').DB_URL_TEST
const { NEXT_PUBLIC_SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: LLAVE } = env('.env.local')
if (!DB) throw new Error('Falta DB_URL_TEST en .env.migracion.')
if (!SB || !LLAVE) throw new Error('Falta la configuración del almacén en .env.local.')

const cabeceras = { apikey: LLAVE, Authorization: `Bearer ${LLAVE}` }

async function conectar() {
  for (let i = 0; i < 6; i++) {
    const cliente = new pg.Client({
      connectionString: DB,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20_000,
      lookup: (host, opts, cb) => dns.lookup(host, { ...opts, family: 4 }, cb),
    })
    try {
      await cliente.connect()
      return cliente
    } catch (e) {
      console.error(`  conexión, intento ${i + 1}: ${e.message}`)
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  throw new Error('No se pudo conectar.')
}

async function subir(ruta, cuerpo, tipo) {
  const r = await fetch(`${SB}/storage/v1/object/publico/${ruta}`, {
    method: 'POST',
    headers: { ...cabeceras, 'Content-Type': tipo, 'x-upsert': 'true' },
    body: new Uint8Array(cuerpo),
  })
  if (!r.ok) throw new Error(`subida ${r.status}: ${await r.text()}`)
}

async function borrarDelAlmacen(bucket, ruta) {
  await fetch(`${SB}/storage/v1/object/${bucket}/${ruta}`, {
    method: 'DELETE',
    headers: cabeceras,
  })
}

/**
 * Una foto libre, distinta por semilla y estable entre corridas.
 *
 * Picsum sirve fotos de Unsplash sin atribución obligatoria. Solo se usa
 * aquí, en un script de desarrollo: la aplicación nunca sale a buscar una
 * imagen a otro dominio.
 */
async function descargar(semilla) {
  const r = await fetch(`https://picsum.photos/seed/${semilla}/900/900`)
  if (!r.ok) throw new Error(`descarga ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

/** El mismo tratamiento que `recorrido.procesar`. */
async function limpiar(original) {
  return await sharp(original)
    .rotate()
    .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })
}

async function sembrarUna(cliente, tipo, id, semilla) {
  const ruta = `${tipo}/${randomUUID()}`
  const imagen = await limpiar(await descargar(semilla))
  await subir(`${ruta}.webp`, imagen.data, 'image/webp')

  await cliente.query(
    `insert into imagenes
       (objeto_tipo, objeto_id, ruta, estado, motivo, ancho, alto, bytes, revisada_at)
     values ($1, $2, $3, 'aprobada', $4, $5, $6, $7, now())`,
    [tipo, id, ruta, MOTIVO, imagen.info.width, imagen.info.height, imagen.data.length],
  )
  return ruta
}

async function main() {
  const cliente = await conectar()

  if (LIMPIAR) {
    const { rows } = await cliente.query(
      `select id, ruta, objeto_tipo, objeto_id from imagenes where motivo = $1`,
      [MOTIVO],
    )
    for (const f of rows) {
      await borrarDelAlmacen('publico', `${f.ruta}.webp`)
      await borrarDelAlmacen('cuarentena', f.ruta)
      await cliente.query('delete from imagenes where id = $1', [f.id])
    }
    // Y se retira la autorización de foto de las fichas que la recibieron
    // aquí: sin imagen, dejarla marcada sería decir que autorizó publicar
    // algo que no existe.
    await cliente.query(`
      update proveedores set acepto_foto = false, foto_version = null, foto_at = null
       where foto_version = 'semilla-de-pruebas'`)
    console.log(`limpiadas ${rows.length} imágenes sembradas.`)
    await cliente.end()
    return
  }

  // Uno de cada tres se queda sin foto. El orden lleva `id` de desempate a
  // propósito: las fichas de prueba se sembraron en lote y comparten
  // `creado_at`, así que sin él Postgres devolvía otro orden en cada corrida
  // y una segunda pasada le ponía foto justo a los que la primera saltó.
  const conFoto = (i) => i % 3 !== 2

  const grupos = [
    {
      tipo: 'proveedor',
      // Las publicadas primero, para que el uno-de-cada-tres sin foto caiga
      // en el directorio y se pueda mirar. Ordenadas por creado_at a secas,
      // los tres sin foto salían todos entre las fichas que no se ven.
      sql: `select p.id, p.nombre_visible as nombre
              from proveedores p
             order by (p.id in (select id from proveedores_publicos)) desc, p.creado_at, p.id`,
    },
    { tipo: 'producto', sql: 'select id, nombre from productos order by creado_at, id' },
    { tipo: 'muro', sql: 'select id, titulo as nombre from publicaciones_muro order by creada_at, id' },
  ]

  for (const g of grupos) {
    const { rows } = await cliente.query(g.sql)
    let puestas = 0
    for (const [i, fila] of rows.entries()) {
      if (!conFoto(i)) continue

      const { rows: ya } = await cliente.query(
        'select 1 from imagenes where objeto_tipo = $1 and objeto_id = $2 limit 1',
        [g.tipo, fila.id],
      )
      if (ya.length > 0) continue

      try {
        await sembrarUna(cliente, g.tipo, fila.id, `${g.tipo}-${fila.id.slice(0, 8)}`)
        if (g.tipo === 'proveedor') {
          await cliente.query(
            `update proveedores
                set acepto_foto = true, foto_version = 'semilla-de-pruebas', foto_at = now()
              where id = $1`,
            [fila.id],
          )
        }
        puestas++
      } catch (e) {
        console.error(`  ${g.tipo} ${fila.nombre}: ${e.message}`)
      }
    }
    const sin = rows.length - rows.filter((_, i) => conFoto(i)).length
    console.log(`${g.tipo}: ${puestas} con foto nueva, ${sin} deliberadamente sin foto, de ${rows.length}.`)
  }

  await cliente.end()
}

await main()
