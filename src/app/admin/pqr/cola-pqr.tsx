'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'

import { rpc } from '@/orpc/cliente'
import { NOMBRE_TIPO_PQR, type PqrEnCola } from '@/contrato/pqr'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Una fila por PQR, con el plazo dicho en días y en palabras.
 *
 * El estado del plazo NO depende solo del color: cada fila lleva escrito
 * cuántos días hábiles quedan o cuántos lleva vencida (regla de interfaz y
 * accesibilidad). El color acompaña, no informa.
 */
function plazoLegible(dias: number) {
  if (dias < 0) return { texto: `Vencida hace ${-dias} días hábiles`, urgente: true }
  if (dias === 0) return { texto: 'Vence hoy', urgente: true }
  if (dias <= 3) return { texto: `Quedan ${dias} días hábiles`, urgente: true }
  return { texto: `Quedan ${dias} días hábiles`, urgente: false }
}

export function ColaPqr({ pqr }: { pqr: PqrEnCola[] }) {
  const router = useRouter()
  const [abierta, setAbierta] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function responder(id: string) {
    if (texto.trim().length < 10) return
    setEnviando(true)
    setError(null)
    try {
      await rpc.pqr.responder({ id, respuesta: texto.trim() })
      setAbierta(null)
      setTexto('')
      router.refresh()
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo responder. Inténtalo otra vez.')
    } finally {
      setEnviando(false)
    }
  }

  if (pqr.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
        No hay ninguna PQR todavía.
      </p>
    )
  }

  return (
    <ul className="mt-6 space-y-3">
      {pqr.map((p) => {
        const plazo = plazoLegible(p.dias_restantes)
        const respondida = p.estado === 'respondida'
        return (
          <li key={p.id} className="shadow-canto rounded-2xl bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
                {NOMBRE_TIPO_PQR[p.tipo]}
              </span>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${
                  respondida
                    ? 'bg-ok-suave text-foreground'
                    : plazo.urgente
                      ? 'bg-familia-rojo text-foreground'
                      : 'bg-accent text-accent-foreground'
                }`}
              >
                {respondida ? 'Respondida' : plazo.texto}
              </span>
            </div>

            <h2 className="font-heading mt-1 text-lg leading-tight">{p.asunto}</h2>
            <p className="mt-2 text-base whitespace-pre-line">{p.detalle}</p>

            {respondida && p.respuesta && (
              <div className="bg-secondary mt-3 rounded-xl p-3">
                <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
                  Lo que se respondió
                </p>
                <p className="mt-1 text-base whitespace-pre-line">{p.respuesta}</p>
              </div>
            )}

            {!respondida &&
              (abierta === p.id ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    maxLength={2000}
                    rows={5}
                    aria-label={`Respuesta a ${p.asunto}`}
                    placeholder="Lo que se le contesta. Lo lee quien tenga el código."
                  />
                  <p className="text-sm text-muted-foreground">
                    {texto.trim().length}/2000. Sin teléfonos ni correos: esto lo
                    lee quien tenga el código, y puede no ser quien lo escribió.
                  </p>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={enviando || texto.trim().length < 10}
                      onClick={() => responder(p.id)}
                    >
                      <Check className="size-4" aria-hidden="true" />
                      {enviando ? 'Enviando…' : 'Responder'}
                    </Button>
                    <Button variant="ghost" onClick={() => setAbierta(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAbierta(p.id)
                      setTexto('')
                      setError(null)
                    }}
                  >
                    Responder
                  </Button>
                </div>
              ))}
          </li>
        )
      })}
    </ul>
  )
}
