'use client'

import type { OficioDeProveedor } from '@/contrato/servicios'
import { MarcoFlujo } from '@/components/marco-flujo'
import {
  useSelectorYPedidoDeOficio,
  CamposSelectorYPedido,
  BotonSelectorYPedido,
} from '@/components/selector-y-pedido-de-oficio'

/**
 * Pedirle un servicio a un prestador concreto (ADR 0017 y ADR 0023).
 *
 * Ruta de respaldo para quien llega con `?proveedor=<id>` desde fuera de la ficha.
 * Usa el mismo estado y los mismos campos que la ficha
 * (`selector-y-pedido-de-oficio.tsx`), pero por separado: esta pantalla es un
 * FLUJO (`MarcoFlujo`), y la regla de interfaz 9 exige que su acción viva en
 * la barra fija de abajo, no dentro del contenido que se desplaza junto con
 * el detalle y la nota.
 */
export function FormularioPublicarServicio({
  proveedorId,
  proveedorNombre,
  oficios,
}: {
  proveedorId: string
  proveedorNombre: string
  oficios: OficioDeProveedor[]
}) {
  const estado = useSelectorYPedidoDeOficio({ proveedorId, oficios })

  return (
    <MarcoFlujo
      titulo="Pedir servicio"
      subtitulo={`A ${proveedorNombre}`}
      volver={`/prestador/${proveedorId}`}
      accion={<BotonSelectorYPedido estado={estado} texto="Enviar pedido" />}
    >
      <CamposSelectorYPedido oficios={oficios} estado={estado} />
    </MarcoFlujo>
  )
}
