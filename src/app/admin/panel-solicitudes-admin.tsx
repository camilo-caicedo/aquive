'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { describirItem } from '@/lib/catalogo'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { SolicitudAdmin } from '@/lib/types'

/**
 * Comentar una solicitud, y cerrarla cuando hay certeza de que se entregó.
 *
 * El caso que faltaba: uno se entera por fuera —una llamada, alguien que lo
 * cuenta— de que algo ya se resolvió, y la solicitud seguía en el tablero
 * moviendo gente para nada.
 *
 * ⚠ Cerrar aquí NO borra. Se marca `cumplida`, que la saca del tablero;
 * quien pidió conserva su enlace, sus respuestas y su plazo, y se borra
 * sola a las 72 horas como todas. Es la solicitud de otra persona.
 */
export function PanelSolicitudesAdmin({ solicitudes }: { solicitudes: SolicitudAdmin[] }) {
  const router = useRouter()
  const [abierta, setAbierta] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(codigo: string, cerrar: boolean) {
    if (nota.trim().length < 3) {
      setError('Escribe qué pasó, aunque sea corto.')
      return
    }
    setEnviando(true)
    setError(null)

    const { error: rpcError } = await createClient().rpc('admin_anotar_solicitud', {
      p_codigo: codigo,
      p_nota: nota.trim(),
      p_cerrar: cerrar,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    setAbierta(null)
    setNota('')
    setEnviando(false)
    router.refresh()
  }

  if (solicitudes.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-border p-6 text-center text-base text-muted-foreground">
        No hay solicitudes vivas ahora mismo.
      </p>
    )
  }

  return (
    <ul className="mt-3 space-y-3">
      {solicitudes.map((s) => {
        const cerrada = s.estado === 'cumplida'
        return (
          <li
            key={s.codigo}
            className={`rounded-xl border p-4 ${cerrada ? 'border-border bg-muted/40' : 'border-border'}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-lg font-bold">{s.codigo}</span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-4" aria-hidden="true" />
                {s.respuestas === 0
                  ? 'sin respuestas'
                  : `${s.respuestas} ${s.respuestas === 1 ? 'respuesta' : 'respuestas'}`}
              </span>
            </div>

            <p className="mt-1 text-base text-muted-foreground">
              {s.municipio} — {s.barrio}
            </p>

            <ul className="mt-2 flex flex-wrap gap-1.5">
              {s.items.map((it, i) => (
                <li key={i} className="rounded-full bg-muted px-3 py-1 text-sm">
                  {describirItem(it)}
                </li>
              ))}
            </ul>

            {s.nota && <p className="mt-2 text-base text-muted-foreground">«{s.nota}»</p>}

            {/* Excepción explícita a la regla 1 de CLAUDE.md — ver
                supabase/migraciones/v2-k4-contacto-solicitante.sql. Solo
                lo ve el administrador, nunca sale en el tablero. */}
            {(s.contacto?.nombre || s.contacto?.telefono || s.contacto?.correo) && (
              <div className="mt-2 rounded-lg border border-primary/30 bg-accent p-2 text-base text-accent-foreground">
                <p className="font-medium">Contacto que dejó quien pidió</p>
                {s.contacto.nombre && <p>{s.contacto.nombre}</p>}
                {s.contacto.telefono && <p>{s.contacto.telefono}</p>}
                {s.contacto.correo && <p>{s.contacto.correo}</p>}
              </div>
            )}

            {cerrada && (
              <p className="mt-2 flex items-center gap-1.5 text-base text-ok">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                Marcada como entregada. Ya no sale en el tablero.
              </p>
            )}

            {s.nota_admin && (
              <p className="mt-2 rounded-lg bg-accent p-2 text-base text-accent-foreground">
                {s.nota_admin}
              </p>
            )}

            {abierta === s.codigo ? (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  maxLength={200}
                  rows={2}
                  aria-label="Comentario"
                  placeholder="Ej: Ya se entregó por medio de la fundación, no hace falta ir."
                />
                <p className="text-sm text-muted-foreground">
                  Esto lo lee cualquiera en el tablero. Di qué pasó, no de
                  quién: nada de nombres, teléfonos ni direcciones.
                </p>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAbierta(null)
                      setError(null)
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="outline"
                    disabled={enviando}
                    onClick={() => guardar(s.codigo, false)}
                  >
                    Solo comentar
                  </Button>
                  <Button disabled={enviando} onClick={() => guardar(s.codigo, true)}>
                    {enviando ? 'Guardando…' : 'Marcar entregada'}
                  </Button>
                </div>
              </div>
            ) : (
              !cerrada && (
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => {
                    setAbierta(s.codigo)
                    setNota(s.nota_admin ?? '')
                    setError(null)
                  }}
                >
                  <MessageSquare className="size-5" aria-hidden="true" />
                  Comentar o cerrar
                </Button>
              )
            )}
          </li>
        )
      })}
    </ul>
  )
}
