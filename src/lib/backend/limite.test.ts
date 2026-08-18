import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clienteIp, limitar, type ConfigLimite } from './limite'

const CONFIG: ConfigLimite = { nombre: 'prueba', max: 3, ventanaSegundos: 60 }

function peticion(cabeceras: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/x', { method: 'POST', headers: cabeceras })
}

test('clienteIp toma el primer salto de x-forwarded-for', () => {
  const req = peticion({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })
  assert.equal(clienteIp(req), '203.0.113.7')
})

test('clienteIp devuelve cadena vacía si falta la cabecera', () => {
  assert.equal(clienteIp(peticion()), '')
})

test('limitar devuelve null cuando el consumidor permite', async () => {
  const res = await limitar(peticion(), CONFIG, async () => true)
  assert.equal(res, null)
})

test('limitar devuelve 429 cuando el consumidor niega', async () => {
  const res = await limitar(peticion(), CONFIG, async () => false)
  assert.ok(res, 'debía devolver una respuesta')
  assert.equal(res.status, 429)
})

test('limitar FALLA ABIERTO: si el consumidor lanza, devuelve null', async () => {
  const res = await limitar(peticion(), CONFIG, async () => {
    throw new Error('base caída')
  })
  assert.equal(res, null)
})

test('limitar arma la clave con nombre e IP', async () => {
  let claveVista = ''
  await limitar(peticion({ 'x-forwarded-for': '203.0.113.7' }), CONFIG, async (clave) => {
    claveVista = clave
    return true
  })
  assert.equal(claveVista, 'prueba:203.0.113.7')
})
