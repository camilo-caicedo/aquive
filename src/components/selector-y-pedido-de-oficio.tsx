'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { rpc } from '@/orpc/cliente'
import { validarNota } from '@/lib/validacion'
import type { OficioDeProveedor } from '@/contrato/servicios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Selector de oficio y envío de pedido de servicio a un prestador concreto.
 *
 * ADR 0017 y ADR 0023. Reutilizado tanto dentro de la ficha (`/prestador/[id]`,
 * un destino — el botón va inline, con `SelectorYPedidoDeOficio`) como en la
 * ruta de respaldo `/servicios/publicar?proveedor=<id>` (un flujo — el botón
 * va en la barra fija de `MarcoFlujo`, con `useSelectorYPedidoDeOficio` +
 * `CamposSelectorYPedido` + `BotonSelectorYPedido` por separado). Regla de
 * interfaz 9: un flujo nunca lleva su acción dentro del contenido que
 * se desplaza.
 */
export function useSelectorYPedidoDeOficio({
  proveedorId,
  oficios,
}: {
  proveedorId: string
  oficios: OficioDeProveedor[]
}) {
  const router = useRouter()
  const unico = oficios.length === 1 ? oficios[0] : null
  const [oficioId, setOficioId] = useState(unico?.oficio_id ?? '')
  const [detalle, setDetalle] = useState('')
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errorDetalle = detalle.trim().length >= 3 ? validarNota(detalle.trim()) : null
  const errorNota = nota.trim() ? validarNota(nota.trim()) : null
  const puedeEnviar = Boolean(oficioId) && !errorDetalle && !errorNota

  async function enviar() {
    setEnviando(true)
    setError(null)
    try {
      const { id } = await rpc.servicios.publicarSolicitud({
        proveedor_id: proveedorId,
        oficio_id: oficioId,
        detalle: detalle.trim() || undefined,
        nota: nota.trim() || undefined,
      })
      router.push(`/chat/solicitud/${id}`)
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo enviar el pedido')
      setEnviando(false)
    }
  }

  return {
    unico,
    oficioId,
    setOficioId,
    detalle,
    setDetalle,
    nota,
    setNota,
    enviando,
    error,
    errorDetalle,
    errorNota,
    puedeEnviar,
    enviar,
  }
}

type EstadoSelector = ReturnType<typeof useSelectorYPedidoDeOficio>

/** Los campos — selector de oficio, detalle, nota — sin el botón. */
export function CamposSelectorYPedido({
  oficios,
  estado,
}: {
  oficios: OficioDeProveedor[]
  estado: EstadoSelector
}) {
  return (
    <div className="space-y-4">
      {estado.unico ? (
        <p className="rounded-2xl bg-card p-3 text-base shadow-canto">
          Vas a solicitar: <span className="font-semibold">{estado.unico.nombre}</span>
        </p>
      ) : (
        <fieldset>
          <legend className="mb-2 text-base font-medium">¿Qué servicio necesitas?</legend>
          <div className="flex flex-wrap gap-2">
            {oficios.map((o) => (
              <button
                key={o.oficio_id}
                type="button"
                aria-pressed={estado.oficioId === o.oficio_id}
                onClick={() => estado.setOficioId(o.oficio_id)}
                className={`inline-flex min-h-12 items-center rounded-full border px-4 text-base transition-colors ${
                  estado.oficioId === o.oficio_id
                    ? 'border-enlace bg-secondary font-semibold text-secondary-foreground'
                    : 'border-border bg-card hover:bg-muted'
                }`}
              >
                {o.nombre}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <Label htmlFor="detalle">Detalle del trabajo (opcional)</Label>
        <Input
          id="detalle"
          value={estado.detalle}
          onChange={(e) => estado.setDetalle(e.target.value)}
          maxLength={80}
          className="mt-1"
          placeholder="Ej: Pintar una habitación de 12 metros cuadrados"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          {estado.detalle.trim().length}/80. Sin teléfonos ni direcciones: esos datos se coordinan por el chat.
        </p>
        {estado.errorDetalle && <p className="mt-1 text-sm text-destructive">{estado.errorDetalle}</p>}
      </div>

      <div>
        <Label htmlFor="nota">
          ¿Alguna indicación adicional? <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="nota"
          value={estado.nota}
          onChange={(e) => estado.setNota(e.target.value)}
          maxLength={140}
          rows={3}
          placeholder="Ej: Cuento con los materiales listos para empezar."
          className="mt-1"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          {estado.nota.length}/140. Sin teléfonos ni direcciones.
        </p>
        {estado.errorNota && <p className="mt-1 text-sm text-destructive">{estado.errorNota}</p>}
      </div>

      {estado.error && (
        <Alert variant="destructive">
          <AlertDescription>{estado.error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/** El botón solo — para vivir en la barra fija de un `MarcoFlujo` de flujo. */
export function BotonSelectorYPedido({
  estado,
  texto = 'Enviar solicitud',
  className = 'w-full text-base font-semibold',
}: {
  estado: EstadoSelector
  texto?: string
  className?: string
}) {
  return (
    <Button className={className} disabled={!estado.puedeEnviar || estado.enviando} onClick={estado.enviar}>
      {estado.enviando ? 'Enviando solicitud…' : texto}
    </Button>
  )
}

/**
 * Todo junto — campos y botón inline, uno debajo del otro. Para un
 * DESTINO (la ficha), donde el botón no va en barra fija (ADR 0023).
 */
export function SelectorYPedidoDeOficio({
  proveedorId,
  oficios,
  textoBoton = 'Enviar solicitud',
  className = '',
}: {
  proveedorId: string
  oficios: OficioDeProveedor[]
  textoBoton?: string
  className?: string
}) {
  const estado = useSelectorYPedidoDeOficio({ proveedorId, oficios })
  return (
    <div className={`space-y-4 ${className}`}>
      <CamposSelectorYPedido oficios={oficios} estado={estado} />
      <BotonSelectorYPedido estado={estado} texto={textoBoton} />
    </div>
  )
}
