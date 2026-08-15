// Añade `tiene_avisos` a `leer_solicitud`, generándola DESDE la definición
// que hay en la base para no reescribir a mano una función de 60 líneas.
//
// Hace falta porque `avisosActivosAqui()` mira el navegador, no la
// solicitud: un mismo teléfono tiene UNA suscripción push, y puede existir
// por el lado de quien ofrece mientras esta solicitud no tiene ninguna fila
// en `push_suscripciones`. Preguntarle al navegador daba «ya están activos»
// cuando no lo estaban, y el ofrecimiento no se dibujaba nunca.
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
 where n.nspname = 'public' and p.proname = 'leer_solicitud'`)
await c.end()

const def = rows[0].def
if (def.includes('tiene_avisos')) {
  console.error('Ya lo tiene. Sin tocar nada.')
  process.exit(1)
}

const ancla = `'flujo', v_sol.flujo,`
if (!def.includes(ancla)) {
  console.error('No encontré el ancla en la función. Sin tocar nada.')
  process.exit(1)
}

const conCampo = def.replace(
  ancla,
  `'flujo', v_sol.flujo,
    -- Si ESTA solicitud tiene avisos, que no es lo mismo que si este
    -- navegador tiene una suscripción: un teléfono tiene una sola, y puede
    -- existir por el lado de quien ofrece.
    'tiene_avisos', exists (select 1 from public.push_suscripciones ps
                             where ps.solicitud_id = v_sol.id),`
)

writeFileSync(
  'supabase/migraciones/v2-k2-leer-solicitud-avisos.sql',
  `-- =====================================================================
-- v2 · \`leer_solicitud\` dice si la solicitud ya tiene avisos
--
-- El ofrecimiento de avisos de la pantalla de confirmación se escondía
-- cuando no debía. Preguntaba \`avisosActivosAqui()\`, que mira el
-- NAVEGADOR: un teléfono tiene una sola suscripción push, y basta con que
-- exista por el lado de quien ofrece para que parezca que esta solicitud
-- ya está cubierta. No lo está — son dos tablas distintas.
--
-- ⚠ Generada por \`migracion/gen-leer-solicitud.mjs\` desde la definición
-- real, no escrita a mano.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

${conCampo};

grant execute on function public.leer_solicitud(text) to anon, authenticated;
`
)
console.log('migración generada · leer_solicitud gana tiene_avisos')
