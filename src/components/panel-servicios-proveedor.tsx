'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { contienePII } from '@/lib/validacion'
import type { Database } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Oficio = Database['public']['Tables']['catalogo_oficios']['Row']

export interface MisServicios {
  codigos: {
    id: string
    oficio_nombre: string | null
    creado_at: string
    expira_at: string
    confirmado_at: string | null
  }[]
  resenas: {
    id: string
    cumplimiento: number
    trato: number
    puntualidad: number
    comentario: string | null
    replica: string | null
    oculta: boolean
    creada_at: string
  }[]
}

const NIVEL = ['—', 'Mal', 'Bien', 'Muy bien']

/**
 * Códigos de servicio y reseñas, del lado de quien trabaja.
 *
 * El código se muestra UNA vez, al generarlo. Después solo existe su
 * hash, así que ni él ni un administrador pueden recuperarlo: si se
 * pierde, se genera otro. Se le dice en pantalla, en grande, porque es
 * exactamente el tipo de cosa que se descubre demasiado tarde.
 */
export function PanelServiciosProveedor({
  datos,
  oficios,
  token,
}: {
  datos: MisServicios
  /** Solo los que están en su ficha. */
  oficios: Oficio[]
  token?: string
}) {
  const router = useRouter()
  const [oficioId, setOficioId] = useState('')
  const [codigo, setCodigo] = useState<string | null>(null)
  const [respondiendo, setRespondiendo] = useState<string | null>(null)
  const [replica, setReplica] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errorReplica =
    replica.trim() && contienePII(replica)
      ? 'La respuesta no puede llevar teléfonos ni correos.'
      : null

  const sinUsar = datos.codigos.filter(
    (c) => !c.confirmado_at && new Date(c.expira_at) > new Date()
  )

  async function generar() {
    setOcupado(true)
    setError(null)
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('crear_codigo_servicio', {
      p_oficio_id: oficioId || null,
      p_token: token ?? null,
    })
    setOcupado(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setCodigo(data as unknown as string)
    router.refresh()
  }

  async function responder(id: string) {
    setOcupado(true)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('responder_resena', {
      p_resena_id: id,
      p_replica: replica.trim(),
      p_token: token ?? null,
    })
    setOcupado(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setRespondiendo(null)
    setReplica('')
    router.refresh()
  }

  return (
    <section>
      <h2 className="font-heading text-2xl">Códigos para que te califiquen</h2>
      <p className="mt-1 text-base text-muted-foreground">
        Al terminar un trabajo, genera un código y dáselo a tu cliente. Con él
        puede calificarte, una sola vez. Es la única forma de que alguien te
        califique: nadie que no te haya contratado puede hacerlo.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Panel de tinta, como la pantalla 23 del prototipo: es el único
          momento en la vida del código en que se puede leer, y en un Alert
          genérico se perdía entre el resto de la pantalla.

          El lima aquí SÍ es color de letra, y es el único sitio donde lo
          es: sobre la tinta da 12,46:1. Lo prohibido es el lima sobre
          claro, que se queda en 1,35:1. */}
      {codigo && (
        <div className="mt-3 rounded-2xl bg-foreground p-4 text-background">
          <p className="font-heading text-xs tracking-[0.085em] text-primary uppercase">
            Código nuevo · sin usar
          </p>
          <p className="mt-3 font-mono text-4xl tracking-[0.18em]">{codigo}</p>
          <p className="mt-3 text-base">
            <strong className="font-semibold">Se muestra una sola vez.</strong>{' '}
            Anótalo o mándaselo ahora por WhatsApp. No lo podemos recuperar; si
            se pierde, generas otro.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/85"
              onClick={() => navigator.clipboard.writeText(codigo)}
            >
              <Copy className="size-4" aria-hidden="true" />
              Copiar
            </Button>
            <Button
              className="bg-transparent text-background hover:bg-background/15"
              onClick={() => setCodigo(null)}
            >
              Ya lo entregué
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {oficios.length > 1 && (
          <Select value={oficioId} onValueChange={(v) => setOficioId(v ?? '')}>
            <SelectTrigger
              aria-label="¿De qué trabajo?"
              className="min-w-0 flex-1 bg-background"
            >
              <SelectValue placeholder="¿De qué trabajo?">
                {(v: string) =>
                  oficios.find((o) => o.id === v)?.nombre ?? '¿De qué trabajo?'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sin especificar</SelectItem>
              {oficios.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button onClick={generar} disabled={ocupado}>
          <Ticket className="size-4" aria-hidden="true" />
          Generar un código
        </Button>
      </div>

      <p className="mt-2 text-base text-muted-foreground">
        Tienes {sinUsar.length}{' '}
        {sinUsar.length === 1 ? 'código sin usar' : 'códigos sin usar'}. Los que
        nadie use se borran a los 30 días.
      </p>

      <h2 className="font-heading mt-8 text-2xl">Lo que dicen de tu trabajo</h2>

      {datos.resenas.length === 0 ? (
        <p className="mt-2 text-base text-muted-foreground">
          Todavía nadie te ha calificado.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {datos.resenas.map((r) => (
            <li key={r.id} className="rounded-2xl bg-card p-4 shadow-canto">
              <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
                Cumplimiento: {NIVEL[r.cumplimiento]} · Trato: {NIVEL[r.trato]} ·
                Puntualidad: {NIVEL[r.puntualidad]}
              </p>

              {r.comentario && <p className="mt-2 text-base">{r.comentario}</p>}

              {r.oculta && (
                <p className="mt-2 rounded-xl bg-accent px-3 py-2 text-base text-accent-foreground">
                  Está oculta mientras se revisa un reporte. Nadie la ve en tu
                  ficha.
                </p>
              )}

              {r.replica ? (
                <p className="mt-2 rounded-r-xl border-l-4 border-ok bg-background py-2 pr-3 pl-3 text-base">
                  <span className="font-semibold">Tu respuesta:</span> {r.replica}
                </p>
              ) : respondiendo === r.id ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={replica}
                    onChange={(e) => setReplica(e.target.value)}
                    maxLength={140}
                    rows={2}
                    aria-label="Tu respuesta"
                    placeholder="Cuenta tu versión, en corto."
                  />
                  <p className="text-base text-muted-foreground">
                    {replica.length}/140. Se publica en tu ficha, debajo de la
                    calificación, y se responde una sola vez.
                  </p>
                  {errorReplica && (
                    <p className="text-sm text-destructive">{errorReplica}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => responder(r.id)}
                      disabled={ocupado || !replica.trim() || !!errorReplica}
                    >
                      Publicar respuesta
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setRespondiendo(null)
                        setReplica('')
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setRespondiendo(r.id)}>
                    Responder
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Se dice aquí y no en los términos: es donde alguien acaba de leer
          algo que le pareció injusto. */}
      <p className="mt-4 text-base text-muted-foreground">
        Si una calificación te parece injusta, o alguien te amenazó con ponerte
        una mala para conseguir algo, repórtala desde tu ficha pública. Una
        persona la revisa.
      </p>
    </section>
  )
}
