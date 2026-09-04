import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { PanelServiciosProveedor } from '@/components/panel-servicios-proveedor'
import { cargarPerfil } from '../cargar'
import { SinCarne } from '../sin-carne'

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

  if (!proveedor) {
    return (
      <SinCarne
        titulo="Códigos que generé"
        porque="Un código de servicio lo genera quien prestó el trabajo, al terminarlo. Sale de tu ficha, así que primero hace falta tenerla."
      />
    )
  }

  return (
    <main className="animar-pantalla mx-auto max-w-lg px-4 py-6">
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
