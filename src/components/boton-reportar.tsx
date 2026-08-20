'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SI_ALGO_SALE_MAL } from '@/lib/honestidad'
import type { TipoObjetoReporte, MotivoReporte } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { HojaAccion } from '@/components/hoja-accion'

const MOTIVOS: { valor: MotivoReporte; etiqueta: string }[] = [
  { valor: 'datos_personales', etiqueta: 'Tiene datos personales' },
  { valor: 'estafa', etiqueta: 'Parece una estafa' },
  { valor: 'contenido_ofensivo', etiqueta: 'Contenido ofensivo' },
  { valor: 'informacion_falsa', etiqueta: 'Información falsa' },
  { valor: 'menor_de_edad', etiqueta: 'Involucra a un menor de edad' },
  { valor: 'otro', etiqueta: 'Otro' },
]

/**
 * Reportar algo, en una hoja inferior.
 *
 * Los seis motivos dejan de ser un `<select>` y pasan a opciones tocables:
 * son seis, caben, y un desplegable para elegir entre seis cosas es un
 * toque para abrir, uno para elegir y uno para cerrar.
 *
 * Arriba se dice qué pasa después. Ese texto ya existe en `honestidad.ts`
 * —`SI_ALGO_SALE_MAL`— y se reutiliza entero: dice que lo revisa una
 * persona, que puede borrar el contenido o suspender la cuenta, y que si
 * hay riesgo para alguien ahora mismo eso no es un reporte, es el 123.
 */
export function BotonReportar({
  tipoObjeto,
  objetoId,
}: {
  tipoObjeto: TipoObjetoReporte
  objetoId: string
}) {
  const [motivo, setMotivo] = useState<MotivoReporte>('datos_personales')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function reportar(cerrar: () => void) {
    setEnviando(true)
    const supabase = createClient()
    await supabase.rpc('crear_reporte', {
      p_tipo_objeto: tipoObjeto,
      p_objeto_id: objetoId,
      p_motivo: motivo,
    })
    setEnviado(true)
    setEnviando(false)
    cerrar()
  }

  // El acuse se queda igual: una línea, sin celebración.
  if (enviado) {
    return (
      <p className="text-sm text-muted-foreground">
        Gracias. Una persona lo va a revisar.
      </p>
    )
  }

  return (
    <HojaAccion
      id={`reportar-${objetoId}`}
      titulo="Reportar"
      disparador={(props) => (
        <button
          {...props}
          className="inline-flex min-h-12 items-center gap-1.5 text-sm text-muted-foreground underline"
        >
          <Flag className="size-4" aria-hidden="true" />
          Reportar
        </button>
      )}
      pie={(cerrar) => (
        <Button className="w-full" disabled={enviando} onClick={() => reportar(cerrar)}>
          {enviando ? 'Enviando…' : 'Enviar reporte'}
        </Button>
      )}
    >
      {/* Qué pasa después, antes de elegir el motivo. */}
      <p className="text-base text-muted-foreground">{SI_ALGO_SALE_MAL}</p>

      <fieldset>
        <legend className="text-base font-medium">¿Qué problema hay?</legend>
        <div className="mt-2 flex flex-col gap-2">
          {MOTIVOS.map((m) => (
            <label key={m.valor} className="cursor-pointer">
              <input
                type="radio"
                name={`motivo-${objetoId}`}
                value={m.valor}
                checked={motivo === m.valor}
                onChange={() => setMotivo(m.valor)}
                className="peer sr-only"
              />
              <span className="flex min-h-12 items-center rounded-xl border border-border bg-card px-4 text-base transition-colors peer-checked:border-primary peer-checked:bg-secondary peer-checked:font-semibold peer-checked:text-secondary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                {m.etiqueta}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </HojaAccion>
  )
}
