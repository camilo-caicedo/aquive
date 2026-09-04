// node src/lib/servicios.ubicacion.test.mjs
//
// `ubicacionCompleta` (ADR 0019): barrio obligatorio, comuna nunca bloquea
// -por eso ni siquiera es un parámetro-, y dirección opcional salvo que se
// autorice publicarla.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ubicacionCompleta } from './ubicacion-proveedor.ts'

test('sin municipio, no vale aunque el barrio esté completo', () => {
  assert.equal(ubicacionCompleta({ municipio: '', barrio: 'San Fernando' }), false)
})

test('sin barrio, no vale aunque el municipio esté puesto', () => {
  assert.equal(ubicacionCompleta({ municipio: '76001', barrio: '' }), false)
})

test('un barrio de una sola letra no basta (mínimo 2 caracteres)', () => {
  assert.equal(ubicacionCompleta({ municipio: '76001', barrio: 'X' }), false)
})

test('municipio y barrio bastan, sin comuna y sin dirección', () => {
  assert.equal(ubicacionCompleta({ municipio: '76001', barrio: 'San Fernando' }), true)
})

test('con dirección escrita pero sin autorizar publicarla, igual vale', () => {
  assert.equal(
    ubicacionCompleta({
      municipio: '76001',
      barrio: 'San Fernando',
      direccion: 'Calle 5 #23-40',
      autorizaDireccion: false,
    }),
    true,
  )
})

test('autorizar publicar la dirección sin haber escrito ninguna, no vale', () => {
  assert.equal(
    ubicacionCompleta({
      municipio: '76001',
      barrio: 'San Fernando',
      direccion: '',
      autorizaDireccion: true,
    }),
    false,
  )
})

test('autorizar publicar la dirección con una dirección de solo espacios, no vale', () => {
  assert.equal(
    ubicacionCompleta({
      municipio: '76001',
      barrio: 'San Fernando',
      direccion: '   ',
      autorizaDireccion: true,
    }),
    false,
  )
})

test('autorizar publicar la dirección con dirección escrita, vale', () => {
  assert.equal(
    ubicacionCompleta({
      municipio: '76001',
      barrio: 'San Fernando',
      direccion: 'Calle 5 #23-40',
      autorizaDireccion: true,
    }),
    true,
  )
})
