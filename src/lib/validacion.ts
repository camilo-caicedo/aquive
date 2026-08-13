// Mismo patrón que la RPC crear_solicitud en Postgres — se valida en los
// dos lados a propósito (CLAUDE.md regla 2). Si uno cambia, cambia el otro.
const PATRON_PII = /(\+?57)?[ -]?3\d{9}|\d{7,}|@[a-zA-Z0-9._-]+\.[a-z]{2,}/i

export function contienePII(texto: string): boolean {
  return PATRON_PII.test(texto)
}

export function validarBarrio(barrio: string): string | null {
  const limpio = barrio.trim()
  if (limpio.length < 2 || limpio.length > 60) {
    return 'El barrio debe tener entre 2 y 60 caracteres'
  }
  if (contienePII(limpio)) {
    return 'No incluyas teléfonos, correos ni números de identificación'
  }
  return null
}

export function validarNota(nota: string): string | null {
  if (nota.length > 140) {
    return 'Máximo 140 caracteres'
  }
  if (contienePII(nota)) {
    return 'No incluyas teléfonos, correos ni números de identificación'
  }
  return null
}
