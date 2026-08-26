import ConfirmarPage from '@/app/servicios/confirmar/page'
import { HojaModal } from '@/components/hoja-modal'

export default async function ConfirmarInterceptado() {
  return (
    <HojaModal etiqueta="Calificar un trabajo">
      <ConfirmarPage />
    </HojaModal>
  )
}
