// Pega el departamento al nombre del municipio en todo lo que se muestra.
//
// Hay municipios con el mismo nombre en departamentos distintos —Albán está
// en Cundinamarca y en Nariño, y así unos cuantos—, así que «Albán» a secas
// no identifica nada.
//
// ⚠ Genera la migración DESDE las definiciones que hay en la base, no de
// memoria. Reescribir a mano una función de 60 líneas ya rompió
// `expirar_solicitudes` una vez.
import { readFileSync, writeFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env.migracion', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')])
)

// Cada entrada: el texto exacto a sustituir dentro de esa función.
const FUNCIONES = {
  mis_hilos: `'municipio',     m.nombre,`,
  solicitudes_de_mi_organizacion: `'municipio',     m.nombre,`,
  solicitudes_admin: `'municipio',   m.nombre,`,
  coincidencias_para_aliado: `'municipio',          m.nombre,`,
  panel_admin_flujo2: `'municipio', m.nombre,`,
}

const c = new pg.Client({ connectionString: env.DB_URL_PROD, ssl: { rejectUnauthorized: false } })
await c.connect()

async function grantsDe(nombre) {
  const { rows } = await c.query(
    `select pg_get_userbyid(a.grantee) as rol
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where n.nspname = 'public' and p.proname = $1
        and a.privilege_type = 'EXECUTE'
        and pg_get_userbyid(a.grantee) in ('anon','authenticated')
      order by 1`,
    [nombre]
  )
  return rows.map((r) => r.rol)
}

const partes = []
const problemas = []

for (const [nombre, ancla] of Object.entries(FUNCIONES)) {
  const { rows } = await c.query(
    `select pg_get_functiondef(p.oid) as def, pg_get_function_identity_arguments(p.oid) as args
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1`,
    [nombre]
  )
  if (rows.length !== 1) { problemas.push(`${nombre}: ${rows.length} definiciones`); continue }
  const def = rows[0].def
  if (def.includes(`m.departamento`)) { problemas.push(`${nombre}: ya lo tiene`); continue }
  const veces = def.split(ancla).length - 1
  if (veces !== 1) { problemas.push(`${nombre}: el ancla aparece ${veces} veces`); continue }
  partes.push({
    nombre,
    args: rows[0].args,
    grants: await grantsDe(nombre),
    sql: def.replace(ancla, ancla.replace('m.nombre,', `m.nombre || ', ' || m.departamento,`)),
  })
}

// `mis_datos` tiene otra forma: una subconsulta, no un join.
{
  const { rows } = await c.query(`select pg_get_functiondef(p.oid) as def
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'mis_datos'`)
  const def = rows[0].def
  const ancla = `(select m.nombre from public.municipios m`
  if (def.includes('m.departamento')) problemas.push('mis_datos: ya lo tiene')
  else if (!def.includes(ancla)) problemas.push('mis_datos: no encontré el ancla')
  else partes.push({
    nombre: 'mis_datos',
    args: 'p_token text',
    grants: await grantsDe('mis_datos'),
    sql: def.replace(ancla, `(select m.nombre || ', ' || m.departamento from public.municipios m`),
  })
}

// La vista: solo cambia la expresión, el nombre y el tipo de la columna
// siguen iguales, asi que `create or replace view` la acepta.
const { rows: vista } = await c.query(
  `select pg_get_viewdef('public.solicitudes_publicas'::regclass, true) as def`
)
const anclaVista = `m.nombre AS municipio_nombre`
if (vista[0].def.includes('m.departamento')) problemas.push('solicitudes_publicas: ya lo tiene')
else if (!vista[0].def.includes(anclaVista)) problemas.push('solicitudes_publicas: no encontré el ancla')

await c.end()

if (problemas.length) {
  console.error('Sin tocar nada:\n  ' + problemas.join('\n  '))
  process.exit(1)
}

// Los grants se copian de la base, no se escriben de memoria. `create or
// replace function` los conserva, así que esto no arregla nada al aplicar
// — pero si alguien recrea el esquema desde los archivos, un `mis_datos`
// sin `anon` dejaría a quien pidió sin poder ver sus propios datos.
const cuerpo = partes.map((p) =>
  `${p.sql};\n\ngrant execute on function public.${p.nombre}(${p.args}) to ${p.grants.join(', ')};`
).join('\n\n')

writeFileSync(
  'supabase/migraciones/v2-k3-municipio-con-departamento.sql',
  `-- =====================================================================
-- v2 · el departamento viaja pegado al nombre del municipio
--
-- Hay municipios que se llaman igual en departamentos distintos: Albán
-- está en Cundinamarca y en Nariño, y no es el único. «Albán» a secas no
-- dice a dónde hay que llevar nada.
--
-- El campo se llama \`municipio\` y es el que se pinta, así que lleva el
-- texto completo. Los identificadores no se tocan: para comparar y para
-- filtrar se sigue usando \`codigo_dane\`.
--
-- ⚠ Generada por \`migracion/gen-municipio-departamento.mjs\` desde las
-- definiciones reales, no escrita a mano.
--
-- Idempotente: el generador se niega a correr si ya está aplicada.
-- =====================================================================

create or replace view public.solicitudes_publicas as
${vista[0].def.replace(anclaVista, `m.nombre || ', ' || m.departamento AS municipio_nombre`)}

${cuerpo}
`
)
console.log('migración generada · ' + [...partes.map((p) => p.nombre), 'solicitudes_publicas'].join(', '))
