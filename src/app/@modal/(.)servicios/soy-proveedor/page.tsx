import SoyProveedorPage from '@/app/servicios/soy-proveedor/page'
import { HojaModal } from '@/components/hoja-modal'

/**
 * Armar la ficha propia, en una hoja encima de lo que se estaba mirando.
 *
 * `/servicios/soy-proveedor/listo` no se intercepta y no hace falta: es el
 * final del recorrido, la hoja se cierra sola al cambiar de ruta y esa
 * pantalla se queda entera, que es lo que pide un «ya está».
 */
export default async function SoyProveedorInterceptado() {
  return (
    <HojaModal etiqueta="Ofrecer mi trabajo" ruta="/servicios/soy-proveedor">
      <SoyProveedorPage />
    </HojaModal>
  )
}
