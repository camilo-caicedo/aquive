import PublicarPage from '@/app/publicar/page'
import { HojaModal } from '@/components/hoja-modal'

export default async function PublicarInterceptado() {
  return (
    <HojaModal etiqueta="Pedir ayuda" variante="pantalla">
      <PublicarPage />
    </HojaModal>
  )
}
