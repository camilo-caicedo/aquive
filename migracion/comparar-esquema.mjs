import { readFileSync } from 'node:fs'
import pg from 'pg'
const env = Object.fromEntries(readFileSync('.env.migracion','utf8').split(/\r?\n/)
  .map(l=>l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean)
  .map(m=>[m[1], m[2].replace(/^['"]|['"]$/g,'')]))
const SQL = `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as firma,
                    p.prosrc as cuerpo
               from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' order by 1`
const leer = async (url) => {
  const c = new pg.Client({ connectionString: url, ssl:{rejectUnauthorized:false} })
  await c.connect(); const { rows } = await c.query(SQL); await c.end()
  return new Map(rows.map(r => [r.firma, r.cuerpo]))
}
// Normaliza saltos de linea: el mismo SQL aplicado desde un archivo con
// CRLF y desde una cadena con LF produce cuerpos distintos byte a byte
// pero identicos como codigo.
const norm = (s) => s.replace(/\r\n/g, '\n')
const [t, p] = await Promise.all([leer(env.DB_URL_TEST), leer(env.DB_URL_PROD)])
const soloTest = [...t.keys()].filter(k => !p.has(k))
const soloProd = [...p.keys()].filter(k => !t.has(k))
const crudo = [...t.keys()].filter(k => p.has(k) && p.get(k) !== t.get(k))
const real  = crudo.filter(k => norm(p.get(k)) !== norm(t.get(k)))
console.log('funciones · pruebas:', t.size, '| produccion:', p.size)
console.log('solo en pruebas   :', soloTest.length ? soloTest.map(s=>s.split('(')[0]).join(', ') : 'ninguna')
console.log('solo en produccion:', soloProd.length ? soloProd.map(s=>s.split('(')[0]).join(', ') : 'ninguna')
console.log('difieren byte a byte:', crudo.length, '(casi todo CRLF vs LF)')
console.log('DIFERENCIA REAL DE CODIGO:', real.length ? real.map(s=>s.split('(')[0]).join(', ') : 'NINGUNA')
