'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { describirItem, categoria as categoriaInfo } from '@/lib/catalogo'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { SolicitudAdmin } from '@/lib/types'
import { useAviso } from '@/components/avisos'

/**
 * Una solicitud en la cola de administración: comentarla, y cerrarla
 * cuando hay certeza de que se entregó.
 *
 * ⚠ Cerrar aquí NO borra. Se marca `cumplida`, que la saca del tablero;
 * quien pidió conserva su enlace, sus respuestas y su plazo, y se borra
 * sola a las 72 horas como todas. Es la solicitud de otra persona.
 *
 * El campo de nota ya no se abre detrás de un botón: en una cola de doce,
 * abrir y cerrar ES el trabajo. Y los avisos dejaron de vivir arriba de la
 * pantalla —donde se leen una vez y se olvidan— para pegarse cada uno a
 * donde aplica: el de la nota bajo la nota, el de que no borra bajo el
 * botón que cierra.
 */
function FilaSolicitud({ s }: { s: SolicitudAdmin }) {
  const router = useRouter()
  const avisar = useAviso()
  const [nota, setNota] = useState(s.nota_admin ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cerrada = s.estado === 'cumplida'

  async function guardar(cerrar: boolean) {
    if (nota.trim().length < 3) {
      setError('Escribe qué pasó, aunque sea corto.')
      return
    }
    setEnviando(true)
    setError(null)

    const { error: rpcError } = await createClient().rpc('admin_anotar_solicitud', {
      p_codigo: s.codigo,
      p_nota: nota.trim(),
      p_cerrar: cerrar,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    setEnviando(false)
    avisar('Marcada como revisada')
    router.refresh()
  }

  return (
    <li className="rounded-2xl bg-card p-4 shadow-canto">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-heading text-lg leading-tight">
          {categoriaInfo(s.categoria).etiqueta} · {s.barrio}
        </span>
        <span className="text-sm text-muted-foreground">
          {s.respuestas === 0
            ? 'sin respuestas'
            : `${s.respuestas} ${s.respuestas === 1 ? 'respuesta' : 'respuestas'}`}
        </span>
      </div>

      <p className="mt-0.5 text-base text-muted-foreground">
        {s.municipio} · <span className="font-mono">{s.codigo}</span>
      </p>

      <ul className="mt-2 flex flex-wrap gap-1.5">
        {s.items.map((it, i) => (
          <li key={i} className="rounded-full bg-muted px-3 py-1 text-sm">
            {describirItem(it)}
          </li>
        ))}
      </ul>

      {s.nota && <p className="mt-2 text-base text-muted-foreground">«{s.nota}»</p>}

      {/* ⚠ Aquí se enseñaba «el contacto que dejó quien pidió», de
          `solicitudes_contacto`. Esa tabla lleva vacía desde el ADR 0006:
          nadie deja un contacto suelto porque quien pide tiene cuenta, y su
          teléfono no se publica en ninguna parte. El bloque no se veía nunca
          y describía una excepción a la regla 1 que ya no existe. */}

      {cerrada ? (
        <>
          <p className="mt-3 flex items-center gap-1.5 text-base text-foreground">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            Marcada como entregada. Ya no sale en el tablero.
          </p>
          {s.nota_admin && (
            <p className="mt-2 rounded-lg bg-muted p-3 text-base">{s.nota_admin}</p>
          )}
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <Textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={200}
            rows={2}
            aria-label={`Comentario sobre ${s.codigo}`}
            placeholder="Ej: Ya se entregó por medio de la fundación, no hace falta ir."
          />
          <p className="text-base text-muted-foreground">
            Esto lo lee cualquiera en el tablero. Di qué pasó, no de quién:
            nada de nombres, teléfonos ni direcciones.
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={enviando}
              onClick={() => guardar(false)}
            >
              <MessageSquare className="size-4" aria-hidden="true" />
              Solo comentar
            </Button>
            <Button disabled={enviando} onClick={() => guardar(true)}>
              {enviando ? 'Guardando…' : 'Marcar entregada'}
            </Button>
          </div>
          <p className="text-base text-muted-foreground">
            Marcarla entregada la saca del tablero pero <strong>no la borra</strong>:
            quien pidió conserva su enlace y sus respuestas, y se borra sola a
            las 72 horas como todas.
          </p>
        </div>
      )}
    </li>
  )
}

export function PanelSolicitudesAdmin({ solicitudes }: { solicitudes: SolicitudAdmin[] }) {
  if (solicitudes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-base text-muted-foreground">
        No hay solicitudes que cumplan ese filtro.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {solicitudes.map((s) => (
        <FilaSolicitud key={s.codigo} s={s} />
      ))}
    </ul>
  )
}
