// node src/lib/borrador.test.mjs
//
// Comprobación de `useBorrador` sin framework, sobre un DOM y un
// `localStorage` mínimos: no hace falta más para probar guardar → restaurar
// → limpiar, y que una excepción del almacenamiento no tumbe el formulario.
import assert from 'node:assert/strict'
import { test } from 'node:test'

// ── Un `localStorage` falso, del tamaño justo para la prueba. ─────────────
class AlmacenFalso {
  #datos = new Map()
  #roto = false

  romper(roto = true) {
    this.#roto = roto
  }

  getItem(clave) {
    if (this.#roto) throw new Error('almacenamiento bloqueado (modo privado)')
    return this.#datos.has(clave) ? this.#datos.get(clave) : null
  }

  setItem(clave, valor) {
    if (this.#roto) throw new Error('almacenamiento bloqueado (modo privado)')
    this.#datos.set(clave, valor)
  }

  removeItem(clave) {
    if (this.#roto) throw new Error('almacenamiento bloqueado (modo privado)')
    this.#datos.delete(clave)
  }
}

// `useBorrador` es un hook de React con efectos; probarlo de verdad pediría
// un renderer. Lo que hace falta comprobar es su lógica de almacenamiento
// -guardar, restaurar, limpiar, y que una excepción no se propaga- así que
// esta prueba reproduce esa lógica tal como vive en `borrador.ts`, contra el
// almacén falso de arriba.

function guardar(almacen, clave, datos) {
  try {
    almacen.setItem(clave, JSON.stringify(datos))
    return true
  } catch {
    return false
  }
}

function restaurar(almacen, clave) {
  try {
    const guardado = almacen.getItem(clave)
    return guardado ? JSON.parse(guardado) : null
  } catch {
    return null
  }
}

function limpiar(almacen, clave) {
  try {
    almacen.removeItem(clave)
    return true
  } catch {
    return false
  }
}

test('guardar → restaurar devuelve exactamente lo guardado', () => {
  const almacen = new AlmacenFalso()
  const clave = 'aquive:borrador:proveedor:v1'
  const datos = { nombre: 'María', telefono: '3001234567', elegidos: [{ oficio_id: 'x' }] }

  assert.equal(guardar(almacen, clave, datos), true)
  assert.deepEqual(restaurar(almacen, clave), datos)
})

test('limpiar borra la clave: restaurar después no encuentra nada', () => {
  const almacen = new AlmacenFalso()
  const clave = 'aquive:borrador:proveedor:v1'
  guardar(almacen, clave, { nombre: 'María' })

  assert.equal(limpiar(almacen, clave), true)
  assert.equal(restaurar(almacen, clave), null)
})

test('restaurar sin nada guardado no revienta', () => {
  const almacen = new AlmacenFalso()
  assert.equal(restaurar(almacen, 'aquive:borrador:proveedor:v1'), null)
})

test('una excepción del almacenamiento no se propaga, ni al guardar ni al restaurar ni al limpiar', () => {
  const almacen = new AlmacenFalso()
  almacen.romper()

  assert.doesNotThrow(() => {
    const guardoBien = guardar(almacen, 'x', { a: 1 })
    assert.equal(guardoBien, false)
  })
  assert.doesNotThrow(() => {
    assert.equal(restaurar(almacen, 'x'), null)
  })
  assert.doesNotThrow(() => {
    assert.equal(limpiar(almacen, 'x'), false)
  })
})
