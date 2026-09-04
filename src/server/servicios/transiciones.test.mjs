// node src/server/servicios/transiciones.test.mjs
//
// Comprobación de la máquina de estados de una orden (ADR 0017), sin base
// de datos ni framework: es la lógica con la que es más fácil equivocarse
// —un salto de estado que no debería existir— y la que más caro sale.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { transicionValida, ESTADOS_SOLICITUD } from './transiciones.ts'

test('pendiente puede pasar a aceptada', () => {
  assert.equal(transicionValida('pendiente', 'aceptada'), true)
})

test('pendiente puede pasar a rechazada', () => {
  assert.equal(transicionValida('pendiente', 'rechazada'), true)
})

test('aceptada puede pasar a realizada', () => {
  assert.equal(transicionValida('aceptada', 'realizada'), true)
})

test('aceptada puede pasar a no_concretada', () => {
  assert.equal(transicionValida('aceptada', 'no_concretada'), true)
})

test('pendiente no puede saltar directo a realizada ni a no_concretada', () => {
  assert.equal(transicionValida('pendiente', 'realizada'), false)
  assert.equal(transicionValida('pendiente', 'no_concretada'), false)
})

test('aceptada no puede volver a pendiente ni ir a rechazada', () => {
  assert.equal(transicionValida('aceptada', 'pendiente'), false)
  assert.equal(transicionValida('aceptada', 'rechazada'), false)
})

test('los tres estados terminales no admiten ninguna transición', () => {
  for (const terminal of ['realizada', 'rechazada', 'no_concretada']) {
    for (const destino of ESTADOS_SOLICITUD) {
      assert.equal(
        transicionValida(terminal, destino),
        false,
        `${terminal} -> ${destino} debería rechazarse`,
      )
    }
  }
})

test('ningún estado admite quedarse en sí mismo', () => {
  for (const estado of ESTADOS_SOLICITUD) {
    assert.equal(transicionValida(estado, estado), false)
  }
})

test('un estado que no existe no admite ninguna transición, ni la produce', () => {
  assert.equal(transicionValida('inventado', 'aceptada'), false)
  assert.equal(transicionValida('pendiente', 'inventado'), false)
})
