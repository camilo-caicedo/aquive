import { FormularioProducto } from './formulario-producto'

export const metadata = { title: 'Vender algo' }

/**
 * Poner un producto en «Hecho en el barrio».
 *
 * No comprueba la sesión aquí: quien no tiene ficha ve el formulario y el
 * rechazo se lo da el dominio, con su motivo en castellano y con el enlace
 * para armarla. Rebotar a `/login` antes de enseñar de qué se trata es
 * pedirle a alguien que se registre para averiguar qué hay detrás.
 */
export default function PublicarProductoPage() {
  return <FormularioProducto />
}
