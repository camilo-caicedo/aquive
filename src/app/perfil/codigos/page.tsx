import { redirect } from 'next/navigation'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { PanelServiciosProveedor } from '@/components/panel-servicios-proveedor'
import { cargarPerfil } from '../cargar'

export const metadata = { title: 'Códigos de servicio' }

/**
 * Pantalla 23 · Códigos de servicio.
 *
 * La mitad de arriba —generar uno y leerlo en el panel de tinta— ya
 * existía. La de abajo, «Los que ya di», no se dibujaba en ninguna parte
 * aunque los datos estuvieran en `mis_servicios` desde el primer día.
 */
export default async function CodigosPage() {
  const { proveedor, servicios, misOficios } = await cargarPerfil()

  // Sin ficha no hay a quién colgarle un código: `crear_codigo_servicio`
  // arranca del proveedor del llamante.
  if (!proveedor) redirect('/servicios/soy-proveedor')

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <CabeceraPantalla titulo="Códigos" volver="/perfil" />

      <p className="text-base text-muted-foreground">
        Al terminar un trabajo le entregas el código a la persona, en papel o
        por WhatsApp. Es lo único que le permite calificarte, y sirve una sola
        vez: nadie que no te haya contratado puede hacerlo.
      </p>

      <div className="mt-4">
        <PanelServiciosProveedor
          datos={servicios}
          oficios={misOficios}
          mostrar="codigos"
        />
      </div>
    </main>
  )
}
