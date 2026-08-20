'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { TipoZona } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface ZonaPropuesta {
  id: string
  municipio: string
  municipio_nombre: string
  departamento: string
  nombre: string
  tipo: TipoZona
  creada_at: string
  usos: number
}

const TIPOS: { valor: TipoZona; etiqueta: string }[] = [
  { valor: 'barrio', etiqueta: 'Barrio' },
  { valor: 'comuna', etiqueta: 'Comuna' },
  { valor: 'corregimiento', etiqueta: 'Corregimiento' },
]

/**
 * Las zonas que escribió la gente y esperan revisión.
 *
 * Solo Cali viene sembrada. En los demás municipios el desplegable lo
 * construye quien vive ahí: escribe su barrio al publicar, cae en esta
 * cola, y una vez aprobado queda en la lista para los siguientes.
 *
 * Se puede corregir el nombre antes de aprobar, que es lo que casi
 * siempre hace falta: llega mal escrito, o llega una comuna marcada como
 * barrio. Rechazar no es descartar a la persona —su ficha se queda como
 * está— es sacar ese nombre de la lista y que no vuelva a proponerse.
 */
export function PanelZonas({ zonas }: { zonas: ZonaPropuesta[] }) {
  const router = useRouter()
  const [editando, setEditando] = useState<Record<string, { nombre: string; tipo: TipoZona }>>({})
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function campo(z: ZonaPropuesta) {
    return editando[z.id] ?? { nombre: z.nombre, tipo: z.tipo }
  }

  async function resolver(z: ZonaPropuesta, aprobar: boolean) {
    setOcupado(true)
    setError(null)
    const c = campo(z)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('resolver_zona', {
      p_id: z.id,
      p_aprobar: aprobar,
      p_nombre: aprobar ? c.nombre.trim() : null,
      p_tipo: aprobar ? c.tipo : null,
    })
    setOcupado(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    router.refresh()
  }

  if (zonas.length === 0) {
    return (
      <p className="mt-3 text-base text-muted-foreground">
        No hay zonas por revisar. Aparecen aquí cuando alguien escribe un
        barrio en un municipio que todavía no tiene comunas cargadas.
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
        {zonas.map((z) => {
          const c = campo(z)
          return (
            <li key={z.id} className="rounded-lg border border-border p-4">
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
                <span>
                  {z.municipio_nombre}, {z.departamento}
                  {z.usos > 1 && ` · la escribieron ${z.usos} veces`}
                </span>
              </p>

              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`zona-${z.id}`} className="sr-only">
                    Nombre de la zona
                  </Label>
                  <Input
                    id={`zona-${z.id}`}
                    value={c.nombre}
                    onChange={(e) =>
                      setEditando((prev) => ({
                        ...prev,
                        [z.id]: { ...c, nombre: e.target.value },
                      }))
                    }
                    maxLength={60}
                  />
                </div>
                <Select
                  value={c.tipo}
                  onValueChange={(v) =>
                    setEditando((prev) => ({
                      ...prev,
                      [z.id]: { ...c, tipo: (v as TipoZona) ?? 'barrio' },
                    }))
                  }
                >
                  <SelectTrigger
                    aria-label={`Tipo de ${z.nombre}`}
                    className="min-w-0 bg-background sm:w-52"
                  >
                    <SelectValue>
                      {(v: string) => TIPOS.find((t) => t.valor === v)?.etiqueta ?? 'Barrio'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.valor} value={t.valor}>
                        {t.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={ocupado || c.nombre.trim().length < 2}
                  onClick={() => resolver(z, true)}
                >
                  Aprobar
                </Button>
                <Button variant="ghost" disabled={ocupado} onClick={() => resolver(z, false)}>
                  Rechazar
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
