// Convierte en cuentas a los prestadores que la fundación dio de alta con
// token (ADR 0006).
//
// Antes, un prestador podía tener dueño de dos maneras: `perfil_id` si
// entró con Google, o `token_hash` si lo registró la fundación. Con cuenta
// para todo hay una sola, así que estos hay que migrarlos ANTES de poner
// `perfil_id not null` — si no, la única salida sería borrarlos, y son
// personas de verdad con su ficha publicada.
//
// A cada uno se le crea su cuenta y se le da un código de acceso. **Ese
// código hay que entregárselo**: es lo único que le permite volver a lo
// suyo, y su token viejo deja de servir.
//
//   node --env-file=.env.local scripts/migrar-proveedores-a-cuentas.mjs
//   node --env-file=.env.local scripts/migrar-proveedores-a-cuentas.mjs --aplicar
//
// Sin `--aplicar` solo dice qué haría.

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'

const aplicar = process.argv.includes('--aplicar')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const db = new Client({ connectionString: process.env.DATABASE_URL })
await db.connect()

const { rows: pendientes } = await db.query(
  `select id, nombre_visible, telefono, municipio
     from proveedores
    where perfil_id is null
    order by nombre_visible`,
)

if (pendientes.length === 0) {
  console.log('No queda ningún prestador sin cuenta.')
  await db.end()
  process.exit(0)
}

console.log(
  `${pendientes.length} prestador${pendientes.length === 1 ? '' : 'es'} sin cuenta` +
    (aplicar ? '. Migrando…\n' : '. Ensayo — nada se va a escribir.\n'),
)

const entregar = []

for (const p of pendientes) {
  if (!aplicar) {
    console.log(`  · ${p.nombre_visible}`)
    continue
  }

  // El correo es sintético: el de la persona no se pide y no se guarda.
  // `aquive.invalid` está reservado por la RFC 2606 para que nunca resuelva.
  const correo = `${randomUUID()}@sin-correo.aquive.invalid`
  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    email_confirm: true,
    user_metadata: { alta_asistida: true, migrado_de_token: true },
  })
  if (error) {
    console.error(`  ✗ ${p.nombre_visible}: ${error.message}`)
    continue
  }

  const codigo = randomBytes(32).toString('base64url')

  try {
    // Su perfil sale de lo que ya tenía la ficha: nombre, teléfono y
    // municipio. No se le pide nada nuevo — es una migración, no un alta.
    await db.query(
      `insert into perfiles (id, nombre_visible, tipo, municipios, contacto_publico,
         contacto_tipo, acepto_publicacion, acepto_politica_at)
       values ($1, $2, 'servidor', $3, $4, 'whatsapp', true, now())`,
      [data.user.id, p.nombre_visible, [p.municipio], p.telefono],
    )
    await db.query(
      'insert into codigos_acceso (perfil_id, codigo_hash) values ($1, $2)',
      [data.user.id, createHash('sha256').update(codigo).digest('hex')],
    )
    // El token viejo se suelta en el MISMO update: mientras exista, el
    // `check (num_nonnulls(perfil_id, token_hash) = 1)` ve dos dueños y
    // rechaza la fila. Es la restricción haciendo su trabajo.
    await db.query(
      'update proveedores set perfil_id = $1, token_hash = null where id = $2',
      [data.user.id, p.id],
    )
  } catch (e) {
    // Sin esto queda un usuario de Auth sin perfil: no puede entrar a nada
    // y nadie sabe que existe.
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {})
    console.error(`  ✗ ${p.nombre_visible}: ${e.message}`)
    continue
  }

  entregar.push({ nombre: p.nombre_visible, codigo })
  console.log(`  ✓ ${p.nombre_visible}`)
}

if (entregar.length > 0) {
  console.log('\n─────────────────────────────────────────────')
  console.log('ENTREGAR A CADA PERSONA. No se puede volver a ver:')
  console.log('en la base solo queda el sha256 del código.\n')
  for (const e of entregar) {
    console.log(`  ${e.nombre}`)
    console.log(`  https://aquive.co/entrar/${encodeURIComponent(e.codigo)}\n`)
  }
}

await db.end()
