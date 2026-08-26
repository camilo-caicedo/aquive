import PublicarServicioPage from '@/app/servicios/publicar/page'
import { HojaModal } from '@/components/hoja-modal'

/**
 * Pedir un servicio, a pantalla completa y sin soltar lo de atrás.
 *
 * `pantalla` y no `hoja`: es un formulario de varios pasos, y en un
 * teléfono una hoja que deja ver la lista por arriba le quita al teclado
 * el sitio que necesita.
 */
export default async function PublicarServicioInterceptado() {
  return (
    <HojaModal etiqueta="Pedir un servicio" variante="pantalla">
      <PublicarServicioPage />
    </HojaModal>
  )
}
