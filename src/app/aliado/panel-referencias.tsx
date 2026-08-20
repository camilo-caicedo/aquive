'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { EstadoReferencia } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { HojaDatoSensible } from '@/components/hoja-dato-sensible'

export interface ReferenciaPorRevisar {
  id: string
  estado: EstadoReferencia
  creada_at: string
  revisada_at: string | null
  oficio_nombre: string | null
  proveedor_id: string
  proveedor_nombre: string
  proveedor_telefono_verificado: boolean
  puedo_leerla: boolean
}

const ESTADOS: Record<EstadoReferencia, string> = {
  pendiente: 'Por llamar',
  confirmada: 'Confirmada',
  no_contesta: 'No contestó',
  rechazada: 'Dijo que no',
}

/**
 * La cola de muestreo de referencias.
 *
 * La lista NO trae nombres ni teléfonos: solo de qué ficha es cada
 * referencia y en qué estado está. El dato se destapa uno por uno, con
 * motivo escrito, y cada vez queda registrado quién lo hizo. Una lista
 * que los trajera todos convertiría un vistazo a la pantalla en cincuenta
 * accesos sin motivo.
 *
 * Lo destapado vive en memoria y se pierde al recargar, a propósito.
 */
export function PanelReferencias({
  referencias,
}: {
  referencias: ReferenciaPorRevisar[]
}) {
  const router = useRouter()
  const [confirmandoRef, setConfirmandoRef] = useState<string | null>(null)
  const [datos, setDatos] = useState<Record<string, { nombre: string; telefono: string }>>({})
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Devuelve el mensaje de error, o null. La hoja se encarga de pedir el
  // motivo, de enseñarlo y de decir que quedó registrado; aquí solo queda
  // la llamada, con los mismos argumentos de siempre.
  async function leer(id: string, motivoEscrito: string) {
    if (motivoEscrito.trim().length < 5) {
      return 'Escribe para qué necesitas verla. Queda registrado.'
    }
    setOcupado(true)
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('leer_referencia', {
      p_id: id,
      p_motivo: motivoEscrito.trim(),
    })
    setOcupado(false)
    if (rpcError) return rpcError.message

    const r = data as unknown as { nombre: string; telefono: string }
    setDatos((prev) => ({ ...prev, [id]: { nombre: r.nombre, telefono: r.telefono } }))
    return null
  }

  async function marcar(id: string, estado: EstadoReferencia) {
    setOcupado(true)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('marcar_referencia', {
      p_id: id,
      p_estado: estado,
    })
    setOcupado(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    router.refresh()
  }

  if (referencias.length === 0) {
    return (
      <p className="mt-3 text-base text-muted-foreground">
        Nadie ha dado referencias todavía.
      </p>
    )
  }

  return (
    <div className="mt-3">
      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ul className="space-y-3">
        {referencias.map((r) => {
          const visto = datos[r.id]
          return (
            <li key={r.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-medium">{r.proveedor_nombre}</span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm">
                  {ESTADOS[r.estado]}
                </span>
              </div>

              {r.oficio_nombre && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Referencia de: {r.oficio_nombre}
                </p>
              )}

              {!r.proveedor_telefono_verificado && (
                <p className="mt-1 text-sm text-accent-foreground">
                  Su propio teléfono todavía está sin verificar.
                </p>
              )}

              {r.puedo_leerla ? (
                <div className="mt-3">
                  <HojaDatoSensible
                    id={`referencia-${r.id}`}
                    titulo="A quién llamar"
                    etiquetaBoton="Ver a quién llamar"
                    explicacion="Son el nombre y el teléfono de un cliente anterior de esta persona, que no está aquí y puede que no sepa que existimos."
                    alAbrir={(m) => leer(r.id, m)}
                  >
                    {visto && (
                      <div className="rounded-xl bg-muted p-3">
                        <p className="text-base font-medium">{visto.nombre}</p>
                        <Button
                          variant="outline"
                          className="mt-2"
                          nativeButton={false}
                          render={<a href={`tel:${visto.telefono}`} />}
                        >
                          <Phone className="size-4" aria-hidden="true" />
                          Llamar al {visto.telefono}
                        </Button>
                      </div>
                    )}
                  </HojaDatoSensible>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No tienes permiso para ver estos datos. Un coordinador lo
                  otorga persona por persona.
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {/* Confirmar no es un cambio de estado cualquiera: es lo
                    que destapa los oficios de riesgo de esa ficha. Se pide
                    confirmación y la consecuencia se dice con palabras en el
                    paso mismo, no en un párrafo debajo que se lee después. */}
                {confirmandoRef === r.id ? (
                  <div className="w-full rounded-xl bg-accent p-3 text-accent-foreground">
                    <p className="text-base">
                      Confirmar esta referencia puede hacer que aparezcan en el
                      directorio los oficios de riesgo de esta persona —cuidado
                      de niños, de personas mayores, transporte— si además su
                      teléfono está verificado.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button onClick={() => marcar(r.id, 'confirmada')} disabled={ocupado}>
                        Sí, confirmó
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmandoRef(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant={r.estado === 'confirmada' ? 'default' : 'outline'}
                    onClick={() => setConfirmandoRef(r.id)}
                    disabled={ocupado}
                  >
                    Confirmó
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => marcar(r.id, 'no_contesta')}
                  disabled={ocupado}
                >
                  No contestó
                </Button>
                <Button
                  variant="outline"
                  onClick={() => marcar(r.id, 'rechazada')}
                  disabled={ocupado}
                >
                  Dijo que no
                </Button>
              </div>

            </li>
          )
        })}
      </ul>
    </div>
  )
}
