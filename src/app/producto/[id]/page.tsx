import { notFound } from 'next/navigation'

import { servidor } from '@/orpc/local'
import { SOMBRA_CARTEL, familiaDe } from '@/lib/familias'
import { MarcoFlujo } from '@/components/marco-flujo'
import { ContenidoProducto } from '@/components/tarjeta-producto'

export const metadata = { title: 'Producto' }

/**
 * Un producto de «Hecho en el barrio», él solo. Mismo motivo y mismo
 * singular que `/profesional/<id>`.
 *
 * Conserva la sombra de color de la familia de quien vende: es lo que hace
 * que la tarjeta de la portada y esto se reconozcan como la misma cosa
 * después de tocar.
 */
export default async function ProductoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const producto = await servidor.comunidad.producto({ id })
  if (!producto) notFound()

  const familia = familiaDe(producto.grupos[0] ?? null)

  return (
    <MarcoFlujo titulo={producto.nombre} volver="/barrio">
      <div className={`overflow-hidden rounded-2xl bg-card ${SOMBRA_CARTEL[familia]}`}>
        <ContenidoProducto producto={producto} completo />
      </div>
    </MarcoFlujo>
  )
}
