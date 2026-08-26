import PublicarServicioPage from '@/app/servicios/publicar/page'
import { HojaModal } from '@/components/hoja-modal'

/**
 * Pedir un servicio, en una hoja encima de la lista.
 *
 * Hoja y no pantalla completa, por decisión del responsable: tapar la
 * pantalla entera hace que un formulario de tres pasos se lea como haberse
 * ido a otro sitio, y lo que se quiere es lo contrario — que se vea que
 * la lista sigue ahí detrás, esperando.
 */
export default async function PublicarServicioInterceptado() {
  return (
    <HojaModal etiqueta="Pedir un servicio">
      <PublicarServicioPage />
    </HojaModal>
  )
}
