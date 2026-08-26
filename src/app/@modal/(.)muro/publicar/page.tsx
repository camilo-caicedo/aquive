import PublicarEnMuroPage from '@/app/muro/publicar/page'
import { HojaModal } from '@/components/hoja-modal'

export default async function PublicarEnMuroInterceptado({
  searchParams,
}: {
  searchParams: Promise<{ cara?: string }>
}) {
  return (
    <HojaModal etiqueta="Publicar en el muro" variante="pantalla">
      <PublicarEnMuroPage searchParams={searchParams} />
    </HojaModal>
  )
}
