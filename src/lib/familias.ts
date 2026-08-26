import type { GrupoOficio } from '@/lib/types'

// Los cuatro gajos de la sombrilla, repartidos entre los ocho grupos de
// oficio. Un solo sitio: si el reparto vive en cada pantalla, dos pantallas
// pintan el mismo grupo de distinto color y el código de color deja de
// significar nada.
//
// El color NUNCA informa solo. Cada tarjeta lleva la palabra del grupo encima
// —«CONFECCIÓN», «CUIDADO»— y el color solo la refuerza. Es la regla de
// interfaz 9: el estado no puede depender de percibir un color, y aquí el
// público incluye gente mayor mirando una pantalla vieja a pleno sol.
//
// El reparto no es arbitrario: los que se confunden entre sí van en colores
// distintos. Comida y aseo se piden por cosas parecidas; cuidado y
// transporte son los dos de riesgo alto y conviene que no compartan color
// con nada más.

export type Familia = 'azul' | 'amarillo' | 'verde' | 'rojo'

const POR_GRUPO: Record<GrupoOficio, Familia> = {
  comida: 'amarillo',
  belleza: 'rojo',
  confeccion: 'azul',
  transporte: 'verde',
  aseo: 'verde',
  cuidado: 'rojo',
  reparacion: 'azul',
  otros: 'amarillo',
}

export function familiaDe(grupo: string | null | undefined): Familia {
  if (!grupo) return 'azul'
  return POR_GRUPO[grupo as GrupoOficio] ?? 'azul'
}

/** La sombra desplazada del cartel, en el color de la familia. */
export const SOMBRA_CARTEL: Record<Familia, string> = {
  azul: 'shadow-cartel-azul',
  amarillo: 'shadow-cartel-amarillo',
  verde: 'shadow-cartel-verde',
  rojo: 'shadow-cartel-rojo',
}

/** El relleno de la cinta superior. Siempre con texto negro encima. */
export const CINTA: Record<Familia, string> = {
  azul: 'bg-familia-azul',
  amarillo: 'bg-familia-amarillo',
  verde: 'bg-familia-verde',
  rojo: 'bg-familia-rojo',
}

/**
 * La tinta de la cinta. El azul es el único de los cuatro suficientemente
 * oscuro para llevar texto blanco (6,31:1); sobre los otros tres el blanco no
 * llega ni a 2:1 y hay que usar negro.
 */
export const TINTA_CINTA: Record<Familia, string> = {
  azul: 'text-white',
  amarillo: 'text-foreground',
  verde: 'text-foreground',
  rojo: 'text-foreground',
}
