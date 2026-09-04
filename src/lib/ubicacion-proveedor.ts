// Sin imports, a propósito: `servicios.ts` importa de `@/contrato`, que un
// `node` suelto no resuelve sin bundler, y esta función tiene que poder
// probarse con `node src/lib/servicios.ubicacion.test.mjs` y nada más.

/**
 * Si la ubicación de una ficha se puede guardar (ADR 0017).
 *
 * El barrio es el dato principal y obligatorio. La comuna no entra aquí
 * ni falta que entre: es secundaria y nunca bloquea, así que no tiene nada
 * que decir sobre si se puede guardar. La dirección es opcional, salvo que
 * se autorice publicarla — ahí sí hace falta que haya algo escrito, o la
 * casilla estaría autorizando publicar la nada.
 */
export function ubicacionCompleta({
  municipio,
  barrio,
  direccion,
  autorizaDireccion,
}: {
  municipio: string
  barrio: string
  direccion?: string | null
  autorizaDireccion?: boolean
}): boolean {
  if (municipio.trim() === '') return false
  if (barrio.trim().length < 2) return false
  if (autorizaDireccion && !(direccion ?? '').trim()) return false
  return true
}
