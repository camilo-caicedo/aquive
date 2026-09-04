'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { rpc } from '@/orpc/cliente'

import { validarNota } from '@/lib/validacion'
import type { OficioDeProveedor } from '@/contrato/servicios'
import { MarcoFlujo } from '@/components/marco-flujo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Pedirle un servicio a un prestador concreto (ADR 0015).
 *
 * ⚠ Solo ofrece lo que ESTA ficha ya declaró — `ficha.oficios`, no el
 * catálogo de 81 oficios en doce categorías—. Ofrecerle a una modista un
 * oficio que no hace es el mismo tablero abierto que el ADR 0014 acaba de
 * retirar, con un paso de categoría de más. Por eso tampoco hay paso de
 * categoría ni «¿no encuentras lo tuyo?»: el universo ya es pequeño y es
 * exactamente lo que ese prestador ofrece. Si la ficha tiene un solo
 * oficio, no se hace elegir: se muestra y ya.
 *
 * Quedan el detalle opcional (80) y la nota (140), con sus filtros de
 * patrones intactos. Al enviar se crea el hilo en la misma operación y la
 * pantalla lleva directo a la conversación, con la orden fija arriba.
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
  const router = useRouter()
  const unico = oficios.length === 1 ? oficios[0] : null
  const [oficioId, setOficioId] = useState(unico?.oficio_id ?? '')
  const [detalle, setDetalle] = useState('')
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mismo filtro que el chat: si trae un teléfono o un correo, no se envía
  // y se dice por qué. Solo se comprueba con algo escrito, para no
  // gritarle a nadie por un campo vacío.
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
      // El chat ya existe: la orden vive dentro, con su tarjeta arriba.
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

  return (
    <MarcoFlujo
      titulo="Pedir servicio"
      subtitulo={`A ${proveedorNombre}`}
      volver={`/prestador/${proveedorId}`}
      accion={
        <Button className="w-full" disabled={!puedeEnviar || enviando} onClick={enviar}>
          {enviando ? 'Enviando…' : 'Enviar pedido'}
        </Button>
      }
    >
      <div className="space-y-4">
        {unico ? (
          <p className="rounded-2xl bg-card p-3 text-base shadow-canto">
            Vas a pedir: <span className="font-semibold">{unico.nombre}</span>
          </p>
        ) : (
          <fieldset>
            <legend className="mb-2 text-base font-medium">¿Cuál de sus oficios necesitas?</legend>
            <div className="flex flex-wrap gap-2">
              {oficios.map((o) => (
                <button
                  key={o.oficio_id}
                  type="button"
                  aria-pressed={oficioId === o.oficio_id}
                  onClick={() => setOficioId(o.oficio_id)}
                  className={`inline-flex min-h-12 items-center rounded-full border px-4 text-base transition-colors ${
                    oficioId === o.oficio_id
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
          <Label htmlFor="detalle">Cuéntanos más (opcional)</Label>
          <Input
            id="detalle"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            maxLength={80}
            className="mt-1"
            placeholder="La pieza de atrás, unos 12 metros"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {detalle.trim().length}/80. Sin teléfonos ni direcciones: eso se
            acuerda por el chat de aquí.
          </p>
          {errorDetalle && <p className="mt-1 text-sm text-destructive">{errorDetalle}</p>}
        </div>

        <div>
          <Label htmlFor="nota">
            ¿Algo más? <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={140}
            rows={3}
            placeholder="Son dos pantalones para bajar el ruedo."
            className="mt-1"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {nota.length}/140. Sin nombres, teléfonos ni direcciones.
          </p>
          {errorNota && <p className="mt-1 text-sm text-destructive">{errorNota}</p>}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </MarcoFlujo>
  )
}
