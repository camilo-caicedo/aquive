/**
 * Los cuatro gajos de la sombrilla, en una franja de 8 px.
 *
 * Es lo que hace que una pantalla se reconozca antes de leer una palabra, y
 * por eso pasó de vivir solo en la bienvenida a cerrar el encabezado en toda
 * la aplicación: el mismo remate arriba en las cuarenta pantallas.
 *
 * Decorativa de verdad, y por eso `aria-hidden`. No informa nada que no esté
 * escrito debajo, y el color nunca va solo (ADR 0002): aquí no está diciendo
 * «confección» ni «cuidado», está diciendo «AquíVe».
 *
 * Los cuatro son relleno puro, sin texto encima, así que no les aplica la
 * regla de contraste — no hay nada que leer sobre ellos.
 */
export function FranjaSombrilla() {
  return (
    <div className="flex h-2 w-full shrink-0" aria-hidden="true">
      <span className="bg-familia-azul flex-1" />
      <span className="bg-familia-amarillo flex-1" />
      <span className="bg-familia-verde flex-1" />
      <span className="bg-familia-rojo flex-1" />
    </div>
  )
}
