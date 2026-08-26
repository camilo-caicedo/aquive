'use client'

import { useEffect, useState } from 'react'

/**
 * ¿Ya hidrató esto?
 *
 * Sirve para lo que solo puede existir en el navegador —una hoja inferior,
 * un combobox con buscador— sin desajustar la hidratación: la primera
 * pintada del cliente es idéntica a la del servidor y el cambio ocurre
 * después.
 *
 * ⚠ Antes esto era `useSyncExternalStore` con una tienda constante
 * —`() => true` en cliente, `() => false` en servidor— y en React 19 se
 * queda pegado: la tienda nunca avisa de un cambio, así que después de
 * hidratar nadie vuelve a preguntar por la instantánea y el componente se
 * queda con la del servidor PARA SIEMPRE.
 *
 * Se veía así: al entrar por una URL —recargando o llegando de fuera— los
 * filtros salían desplegados en el cuerpo de la página y los desplegables
 * eran `<select>` nativos, con las esquinas cuadradas y el azul del
 * sistema. Llegando por un enlace de dentro sí se veían bien, porque ahí
 * no hay hidratación de por medio. Cambiar de pantalla lo arreglaba, que
 * es justo lo que hace que no parezca un error.
 *
 * Un efecto sí es fiable: corre una vez, después de la primera pintada.
 */
export function useHidratado() {
  const [hidratado, setHidratado] = useState(false)
  // El lint avisa de que poner estado desde un efecto encadena renders, y
  // tiene razón como norma. Aquí ese render de más ES el objetivo: hay que
  // pintar una vez igual que el servidor y cambiar después, o la
  // hidratación no cuadra. Corre una sola vez y no se repite.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHidratado(true), [])
  return hidratado
}
