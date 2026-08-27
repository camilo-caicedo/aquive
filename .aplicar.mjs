import { readFileSync } from 'node:fs'
import dns from 'node:dns'
import pg from 'pg'

dns.setDefaultResultOrder('ipv4first')

const env = Object.fromEntries(
  readFileSync('.env.migracion', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
)

async function conectar() {
  for (let i = 0; i < 6; i++) {
    const c = new pg.Client({
      connectionString: env.DB_URL_TEST,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
      lookup: (host, opts, cb) => dns.lookup(host, { ...opts, family: 4 }, cb),
    })
    try { await c.connect(); return c } catch (e) {
      console.error(`intento ${i + 1}: ${e.message}`)
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  throw new Error('sin conexión')
}

const c = await conectar()
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('?')) {
    try { const r = await c.query(arg.slice(1)); console.log(arg.slice(1, 70), '→', JSON.stringify(r.rows)) }
    catch (e) { console.log(arg.slice(1, 70), '→ ERROR:', e.message) }
  } else {
    await c.query(readFileSync(arg, 'utf8'))
    console.log('aplicada:', arg)
  }
}
await c.end()
