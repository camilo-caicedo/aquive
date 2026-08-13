'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { TipoObjetoReporte, MotivoReporte } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const MOTIVOS: { valor: MotivoReporte; etiqueta: string }[] = [
  { valor: 'datos_personales', etiqueta: 'Tiene datos personales' },
  { valor: 'estafa', etiqueta: 'Parece una estafa' },
  { valor: 'contenido_ofensivo', etiqueta: 'Contenido ofensivo' },
  { valor: 'informacion_falsa', etiqueta: 'Información falsa' },
  { valor: 'menor_de_edad', etiqueta: 'Involucra a un menor de edad' },
  { valor: 'otro', etiqueta: 'Otro' },
]

export function BotonReportar({
  tipoObjeto,
  objetoId,
}: {
  tipoObjeto: TipoObjetoReporte
  objetoId: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState<MotivoReporte>('datos_personales')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function reportar() {
    setEnviando(true)
    const supabase = createClient()
    await supabase.rpc('crear_reporte', {
      p_tipo_objeto: tipoObjeto,
      p_objeto_id: objetoId,
      p_motivo: motivo,
    })
    setEnviado(true)
    setEnviando(false)
  }

  if (enviado) {
    return (
      <p className="text-sm text-muted-foreground">
        Gracias. Una persona lo va a revisar.
      </p>
    )
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex min-h-12 items-center gap-1.5 text-sm text-muted-foreground underline"
      >
        <Flag className="size-4" aria-hidden="true" />
        Reportar
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <Label htmlFor={`motivo-${objetoId}`} className="mb-1">
        ¿Qué problema hay?
      </Label>
      <Select
        value={motivo}
        onValueChange={(v) => setMotivo((v ?? 'datos_personales') as MotivoReporte)}
      >
        <SelectTrigger id={`motivo-${objetoId}`}>
          <SelectValue>
            {(v: string) => MOTIVOS.find((m) => m.valor === v)?.etiqueta ?? ''}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MOTIVOS.map((m) => (
            <SelectItem key={m.valor} value={m.valor}>
              {m.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button className="flex-1" disabled={enviando} onClick={reportar}>
          {enviando ? 'Enviando…' : 'Reportar'}
        </Button>
      </div>
    </div>
  )
}
