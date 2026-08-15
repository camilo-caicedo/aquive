// Genera `v2-j3-techo-cinco-dias.sql` A PARTIR de la definición que hay en
// producción, cambiando solo el intervalo. No se reescribe la función a
// mano: es una `security definer` que decide qué se borra y cuándo, y una
// palabra distinta ahí no se nota hasta que ya se borró algo que no tocaba.
import { readFileSync, writeFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env.migracion', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')])
)

const c = new pg.Client({ connectionString: env.DB_URL_PROD, ssl: { rejectUnauthorized: false } })
await c.connect()
const { rows } = await c.query(`select pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'expirar_solicitudes'`)
await c.end()

const original = rows[0].def
const cuantas = (original.match(/interval '14 days'/g) || []).length
if (cuantas !== 1) {
  console.error(`Esperaba exactamente un "interval '14 days'", encontré ${cuantas}. Sin tocar nada.`)
  process.exit(1)
}

const CABECERA = `-- =====================================================================
-- v2 · El techo de la auto-renovación baja de 14 días a 5
--
-- El techo existe desde \`v2-i1\` y su razón no cambia: una solicitud con
-- coordinación abierta se auto-renueva para que no se borre en mitad de
-- una entrega, pero no puede renovarse para siempre — una conversación
-- estancada mantendría viva una identidad cifrada indefinidamente, y la
-- promesa del proyecto es que esto se borra.
--
-- Lo que cambia es el número, y conviene decir de dónde salía: de ningún
-- sitio. \`PLAN-V2.md\` §5.7-3 justifica que HAYA techo, nunca que sean
-- catorce. Era una estimación de escritorio.
--
-- Cinco días los pone quien opera esto: si una entrega de emergencia no se
-- concreta en cinco días, lo que hay no es una coordinación lenta sino una
-- que no va a ocurrir, y mientras tanto hay un nombre y un documento
-- guardados esperándola.
--
-- ⚠ Este archivo NO está escrito a mano: lo genera
-- \`migracion/gen-techo.mjs\` desde la definición que hay en la base,
-- cambiando solo el intervalo. La función decide qué se borra y cuándo.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

`

const PIE = `
revoke execute on function public.expirar_solicitudes() from public, anon, authenticated;

-- Comprobar (sin ejecutarla — regla 5, nunca a mano):
--   select prosrc like '%interval ''5 days''%' as techo_en_cinco
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'expirar_solicitudes';
`

const salida = CABECERA + original.replace("interval '14 days'", "interval '5 days'") + ';\n' + PIE
writeFileSync('supabase/migraciones/v2-j3-techo-cinco-dias.sql', salida)
console.log('migración generada desde la definición real · 14 days → 5 days')
