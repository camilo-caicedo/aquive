import FichaPage from '@/app/servicios/[id]/page'
import { HojaModal } from '@/components/hoja-modal'

/**
 * La ficha, abierta encima de la lista.
 *
 * Se renderiza la MISMA página, sin copiar nada: lo único que cambia es el
 * caparazón. Dos versiones de una ficha que habla de matrículas y de
 * verificaciones se separarían en la primera corrección que se hiciera en
 * una sola de las dos.
 *
 * La flecha atrás de `MarcoFlujo` ya vuelve a la pantalla anterior, así que
 * dentro del modal cierra, que es lo que tiene que hacer.
 */
export default async function FichaInterceptada({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <HojaModal etiqueta="Ficha del prestador">
      <FichaPage params={params} />
    </HojaModal>
  )
}
