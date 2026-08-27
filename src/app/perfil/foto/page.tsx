import { redirect } from 'next/navigation'
import { FormularioProveedor } from '@/app/servicios/soy-proveedor/formulario-proveedor'
import { cargarPerfil } from '../cargar'

export const metadata = { title: 'Mi foto' }

/**
 * La foto de la ficha, en su propia pantalla.
 *
 * Va aparte de «Mis datos» por la misma razón por la que su casilla va
 * aparte: publicar una cara es otra finalidad que publicar un teléfono
 * (v6-b7, mismo criterio que el ADR 0004 para el punto en el mapa).
 * Metida entre nombre, figura y presentación, la casilla se marcaría de
 * paso mientras se corrige otra cosa, que es justo lo que un
 * consentimiento por finalidad no puede permitir.
 */
export default async function FotoPage() {
  const { proveedor, municipios, oficios, zonas } = await cargarPerfil()

  if (!proveedor) redirect('/servicios/soy-proveedor')

  return (
    <FormularioProveedor
      proveedor={proveedor}
      municipios={municipios}
      oficios={oficios}
      zonas={zonas}
      titulo="Mi foto"
      volver="/servicios/soy-proveedor"
      secciones={['foto']}
      encabezado={
        <p className="text-base text-muted-foreground">
          Es opcional, y quien no la pone aparece igual en el directorio. Una
          persona la revisa antes de que se vea.
        </p>
      }
    />
  )
}
