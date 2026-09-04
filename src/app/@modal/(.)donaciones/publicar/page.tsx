import PublicarDonacionPage from '@/app/donaciones/publicar/page'
import { HojaModal } from '@/components/hoja-modal'

export default async function PublicarDonacionInterceptado() {
  return (
    <HojaModal etiqueta="Publicar una donación" ruta="/donaciones/publicar">
      <PublicarDonacionPage />
    </HojaModal>
  )
}
