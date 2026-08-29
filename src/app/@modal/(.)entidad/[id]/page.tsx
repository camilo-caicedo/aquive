import EntidadPage from '@/app/entidad/[id]/page'
import { HojaModal } from '@/components/hoja-modal'

/** La entidad, abierta encima de lo que se estaba mirando. */
export default async function EntidadInterceptada({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <HojaModal etiqueta="Ficha de la entidad" ruta={`/entidad/${id}`}>
      <EntidadPage params={Promise.resolve({ id })} />
    </HojaModal>
  )
}
