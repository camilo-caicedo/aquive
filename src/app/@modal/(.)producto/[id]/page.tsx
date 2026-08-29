import ProductoPage from '@/app/producto/[id]/page'
import { HojaModal } from '@/components/hoja-modal'

/** El producto, abierto encima de lo que se estaba mirando. */
export default async function ProductoInterceptado({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <HojaModal etiqueta="Producto de Hecho en el barrio" ruta={`/producto/${id}`}>
      <ProductoPage params={Promise.resolve({ id })} />
    </HojaModal>
  )
}
