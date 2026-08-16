import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contienePII, contieneContacto } from './validacion'
import { CORPUS } from './validacion.corpus'

test('contienePII coincide con el corpus en cada caso', () => {
  for (const caso of CORPUS) {
    assert.equal(
      contienePII(caso.texto),
      caso.pii,
      `contienePII(${JSON.stringify(caso.texto)}) debía ser ${caso.pii}`,
    )
  }
})

test('contieneContacto coincide con el corpus en cada caso', () => {
  for (const caso of CORPUS) {
    assert.equal(
      contieneContacto(caso.texto),
      caso.contacto,
      `contieneContacto(${JSON.stringify(caso.texto)}) debía ser ${caso.contacto}`,
    )
  }
})

test('contacto nunca es más laxo que pii', () => {
  for (const caso of CORPUS) {
    if (caso.pii) {
      assert.equal(caso.contacto, true, `${JSON.stringify(caso.texto)}: pii implica contacto`)
    }
  }
})
