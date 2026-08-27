'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { rpc } from '@/orpc/cliente'
import type { Motivo as MotivoReporte, TipoObjeto as TipoObjetoReporte } from '@/contrato/moderacion'
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
  const [fallo, setFallo] = useState(false)

  async function reportar(cerrar: () => void) {
    setEnviando(true)
    try {
      // Por el contrato y no contra Postgres: el navegador deja de tener
      // credenciales de base de datos, y los enums los valida el servidor.
      await rpc.moderacion.reportar({
        tipo_objeto: tipoObjeto,
        objeto_id: objetoId,
        motivo,
      })
      setEnviado(true)
    } catch {
      // Un reporte que no llega no puede quedarse en silencio: quien vio
      // datos de un menor tiene que saber que no se envió.
      setFallo(true)
    } finally {
      setEnviando(false)
      cerrar()
    }
  }

  if (fallo) {
    return (
      <p className="text-sm text-muted-foreground">
        No se pudo enviar el reporte. Revisa la conexión y vuelve a
        intentarlo.
      </p>
    )
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
      titulo="¿Qué problema hay?"
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
        <div className="flex items-center gap-3">
          {/* Cancelar en texto, a la izquierda: reportar a alguien no puede
              ser algo que se toque sin querer, pero salir tampoco puede
              costar buscar la equis. */}
          <button
            type="button"
            onClick={cerrar}
            className="pulsable inline-flex min-h-12 shrink-0 items-center rounded-full px-3 text-base text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancelar
          </button>
          <Button className="flex-1" disabled={enviando} onClick={() => reportar(cerrar)}>
            <Flag className="size-5" aria-hidden="true" />
            {enviando ? 'Enviando…' : 'Reportar'}
          </Button>
        </div>
      )}
    >
      {/* Qué pasa después, antes de elegir el motivo. El texto entero de
          `SI_ALGO_SALE_MAL` vive en /seguridad; aquí va lo que hace falta
          saber para tocar el botón, y el 123, que es lo único urgente. */}
      <p className="text-base text-muted-foreground">
        Lo revisa una persona. Puede borrar el contenido o suspender la cuenta.
        Si hay riesgo para alguien ahora mismo, eso no es un reporte: es el 123.
      </p>

      <fieldset>
        <legend className="sr-only">¿Qué problema hay?</legend>
        <div className="flex flex-col gap-2">
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
              <span className="flex min-h-12 items-center rounded-xl border border-border bg-card px-4 text-base transition-colors peer-checked:border-enlace peer-checked:bg-secondary peer-checked:font-semibold peer-checked:text-secondary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                {m.etiqueta}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </HojaAccion>
  )
}
