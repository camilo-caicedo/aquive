import ProfesionalPage from '@/app/profesional/[id]/page'
import { HojaModal } from '@/components/hoja-modal'

/**
 * El profesional, abierto encima de lo que se estaba mirando.
 *
 * Se renderiza la MISMA página, sin copiar nada: lo único que cambia es el
 * caparazón. Igual que la ficha del prestador.
 */
export default async function ProfesionalInterceptado({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <HojaModal etiqueta="Ficha del profesional" ruta={`/profesional/${id}`}>
      {/* La promesa ya resuelta, para no volver a esperar lo mismo. */}
      <ProfesionalPage params={Promise.resolve({ id })} />
    </HojaModal>
  )
}
