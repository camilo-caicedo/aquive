'use client'

import { createContext, useContext } from 'react'

/**
 * Dónde tiene que portalizarse un desplegable que vive dentro de una hoja
 * inferior.
 *
 * ⚠ Esto no es una comodidad, es lo único que hace que los desplegables se
 * vean. La hoja se abre con el `popover` nativo, y un popover abierto está
 * en la *capa superior* del navegador, que se pinta encima de todo el
 * documento sin importar el `z-index`. Base UI portaliza sus listas al
 * `body` por defecto, así que la lista de municipios quedaba debajo de la
 * hoja: se abría de verdad —`aria-expanded="true"`— y no se veía nada.
 *
 * Con el contenedor puesto, la lista se monta DENTRO del popover y viaja
 * con él a la capa superior.
 *
 * Fuera de una hoja el valor es `null` y todo se portaliza como siempre.
 */
export const ContenedorHoja = createContext<HTMLElement | null>(null)

export function useContenedorHoja() {
  return useContext(ContenedorHoja)
}
