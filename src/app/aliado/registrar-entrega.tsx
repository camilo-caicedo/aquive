'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { HojaDatoSensible } from '@/components/hoja-dato-sensible'
import type { ItemPendiente, Planilla } from '@/lib/types'

/**
 * La pantalla del acopio, y por eso es como es: botones grandes, poco
 * texto, ninguna decisión que no sea «esto llegó, esto no». Se usa de pie,
 * con la caja enfrente, a veces a media luz y con guantes.
 *
 * El código de entrega que trae quien ofrece es el identificador de la
 * conversación: opaco por construcción. Nunca los cuatro últimos dígitos
 * del documento, que es lo que se haría por comodidad y lo que la regla 6
 * prohíbe.
 */
export function RegistrarEntrega({
  conversacionId,
  pendientes,
}: {
  conversacionId: string
  pendientes: ItemPendiente[]
}) {
  const router = useRouter()
  const [marcados, setMarcados] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planilla, setPlanilla] = useState<Planilla | null>(null)
  const [motivo, setMotivo] = useState(false)

  function alternar(id: string) {
    setMarcados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function registrar() {
    if (marcados.length === 0) return
    setEnviando(true)
    setError(null)

    const items = pendientes
      .filter((p) => marcados.includes(p.id))
      .map((p) => ({
        item_id: p.item_id ?? '',
        sugerencia_id: p.sugerencia_id ?? '',
        cantidad: p.cantidad,
      }))

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('registrar_entrega', {
      p_conversacion_id: conversacionId,
      p_items: items as unknown as never,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    setEnviando(false)
    setMarcados([])
    router.refresh()
  }

  // ⚠ El motivo lo escribe la persona en ese momento. Estaba fijo en el
  // código —'Planilla de la entrega en el acopio'— así que la bitácora
  // decía siempre lo mismo y no distinguía un acceso de otro: dejaba de
  // ser evidencia. La firma de la RPC no cambia, solo lo que se le pasa.
  async function pedirPlanilla(motivoEscrito: string) {
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('exportar_planilla', {
      p_conversacion_id: conversacionId,
      p_motivo: motivoEscrito,
    })

    if (rpcError) return rpcError.message

    setPlanilla(data as unknown as Planilla)
    setMotivo(true)
    return null
  }

  return (
    <div className="mt-3 rounded-2xl bg-card p-4 shadow-canto">
      <h4 className="text-lg font-bold">Registrar lo que llegó</h4>

      {pendientes.length === 0 ? (
        <p className="mt-2 text-base text-muted-foreground">
          Ya no queda nada pendiente en esta solicitud.
        </p>
      ) : (
        <>
          <p className="mt-1 text-base text-muted-foreground">
            Toca lo que tienes enfrente. Lo que marques se tacha de la
            solicitud y queda registrado.
          </p>

          <ul className="mt-3 space-y-2">
            {pendientes.map((p) => {
              const activo = marcados.includes(p.id)
              return (
                <li key={p.id}>
                  {/* Fila alta con un círculo de marca a la izquierda: esto
                      se usa de pie, con la caja enfrente y a veces con
                      guantes. Un botón de alto normal se falla. */}
                  <button
                    type="button"
                    aria-pressed={activo}
                    onClick={() => alternar(p.id)}
                    className={`flex min-h-16 w-full items-center gap-3 rounded-xl px-3 text-left text-base transition-colors ${
                      activo ? 'bg-secondary font-semibold text-secondary-foreground' : 'bg-card'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${
                        activo ? 'border-enlace bg-primary text-primary-foreground' : 'border-border'
                      }`}
                    >
                      {activo && <Check className="size-5" />}
                    </span>
                    {p.cantidad} {p.unidad} de {p.nombre}
                  </button>
                </li>
              )
            })}
          </ul>

          <Button
            className="mt-3 w-full"
            disabled={enviando || marcados.length === 0}
            onClick={registrar}
          >
            {enviando
              ? 'Guardando…'
              : `Registrar ${marcados.length} ${marcados.length === 1 ? 'cosa' : 'cosas'}`}
          </Button>
        </>
      )}

      {/* Regla Q: la plataforma no es el archivo de la fundación. La
          planilla se saca AQUÍ, en el momento de la entrega, y la custodia
          la fundación. Cada vez que se pide queda registrado quién la vio
          y por qué. */}
      <div className="mt-4 border-t border-border pt-3">
        <HojaDatoSensible
          id={`planilla-${conversacionId}`}
          titulo="Planilla para firmar"
          etiquetaBoton="Ver la planilla para firmar"
          explicacion="Lleva el nombre, el documento y el teléfono de quien pidió. La custodia es de la fundación, no de AquíVe."
          alAbrir={pedirPlanilla}
        >
          {planilla && motivo && (
        <div className="mt-3 rounded-lg border border-enlace/25 bg-accent p-3 text-accent-foreground">
          <p className="text-base font-medium">{planilla.nombre}</p>
          <p className="text-base">
            {planilla.documento_tipo} {planilla.documento}
            {planilla.telefono ? ` · ${planilla.telefono}` : ''}
          </p>
          <ul className="mt-2 space-y-1 text-base">
            {planilla.entregas.map((e, i) => (
              <li key={i}>
                {e.cantidad} {e.unidad} de {e.item}
                {e.confirmada ? ' · confirmado' : ' · sin confirmar'}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            Autorización aceptada el{' '}
            {new Date(planilla.autorizacion_at).toLocaleDateString('es-CO')} (versión{' '}
            {planilla.autorizacion_version}).
          </p>
        </div>
          )}
        </HojaDatoSensible>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
