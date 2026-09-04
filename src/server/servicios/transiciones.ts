// La máquina de estados de una orden (ADR 0017). Aparte de `solicitudes.ts`
// y sin ninguna dependencia porque es lo único de todo el módulo que se
// puede —y debe— probar sin una base de datos detrás: es la lógica con la
// que es más fácil equivocarse y la que más caro sale, un salto de estado
// que no debería existir.

export const ESTADOS_SOLICITUD = [
  'pendiente',
  'aceptada',
  'realizada',
  'rechazada',
  'no_concretada',
] as const

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number]

/**
 * De qué estado a cuáles otros puede moverla el prestador.
 *
 * `pendiente` es el único estado desde el que se puede llegar a dos
 * sitios distintos; `aceptada` es la otra bifurcación. Los tres restantes
 * son terminales: nada sale de `realizada`, `rechazada` ni `no_concretada`.
 */
const TRANSICIONES: Record<EstadoSolicitud, readonly EstadoSolicitud[]> = {
  pendiente: ['aceptada', 'rechazada'],
  aceptada: ['realizada', 'no_concretada'],
  realizada: [],
  rechazada: [],
  no_concretada: [],
}

/** Si `siguiente` es un salto legal desde `actual`. Cualquier texto que no
 * sea uno de los cinco estados no admite ninguna transición. */
export function transicionValida(actual: string, siguiente: string): boolean {
  const destinos = TRANSICIONES[actual as EstadoSolicitud]
  return destinos ? destinos.includes(siguiente as EstadoSolicitud) : false
}
