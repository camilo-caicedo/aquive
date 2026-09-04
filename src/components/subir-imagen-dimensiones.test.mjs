import assert from 'node:assert/strict'
import { test } from 'node:test'

import { calcularDimensionesDestino } from './subir-imagen-dimensiones.ts'

test('no amplía una imagen ya más pequeña que el lado máximo', () => {
  assert.deepEqual(calcularDimensionesDestino(800, 600, 1600), { ancho: 800, alto: 600 })
})

test('un lado ya en el máximo se queda igual', () => {
  assert.deepEqual(calcularDimensionesDestino(1600, 1200, 1600), { ancho: 1600, alto: 1200 })
})

test('reduce el lado más largo al máximo y escala el otro en proporción', () => {
  // 4000x3000, razón 4:3. El lado largo (4000) baja a 1600; el corto
  // (3000) baja en la misma proporción: 3000 * (1600/4000) = 1200.
  assert.deepEqual(calcularDimensionesDestino(4000, 3000, 1600), { ancho: 1600, alto: 1200 })
})

test('funciona igual si el lado largo es el alto', () => {
  assert.deepEqual(calcularDimensionesDestino(1200, 4800, 1600), { ancho: 400, alto: 1600 })
})

test('un cuadrado grande baja a un cuadrado del lado máximo', () => {
  assert.deepEqual(calcularDimensionesDestino(3000, 3000, 1600), { ancho: 1600, alto: 1600 })
})
