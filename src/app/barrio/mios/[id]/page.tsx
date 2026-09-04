import { notFound } from 'next/navigation'

import { servidor } from '@/orpc/local'
import { FormularioProducto } from '@/app/barrio/publicar/formulario-producto'

export const metadata = { title: 'Corregir producto' }

/**
 * Corregir un producto propio.
 *
 * Lo busca dentro de lo que ya devuelve `misProductos` en vez de pedir una
 * consulta nueva: quien vende tiene tres cosas, no trescientas, y así el
 * «esto no es tuyo» sale de un solo sitio —el dominio filtra por la ficha
 * de quien llama, aquí y al guardar—.
 */
export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const mios = await servidor.comunidad.misProductos()
  const producto = mios.find((p) => p.id === id)
  if (!producto) notFound()

  return <FormularioProducto producto={producto} />
}
