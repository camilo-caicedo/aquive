'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Merge } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { SugerenciaPendiente } from '@/lib/types'

/**
 * Las tres salidas de una sugerencia: fusionar, aprobar o rechazar.
 *
 * La decisión real es «¿esto ya existe con otro nombre?», así que los
 * parecidos van primero y cada uno con su propio botón: si fusionar
 * costara un clic más que aprobar, nadie los usaría y el catálogo se
 * llenaría de sinónimos.
 *
 * Van en terracota tenue y ANTES de la nota, que es donde se decide. Y
 * cuando no hay ninguno se dice, en vez de dejar el hueco: un espacio en
 * blanco no distingue «no busqué» de «busqué y no hay nada».
 *
 * Rechazar deja de ser un `destructive` del mismo tamaño que aprobar: no
 * destruye nada —no crea ni cambia— y es la salida menos frecuente.
 */
export function AccionesSugerencia({ sugerencia }: { sugerencia: SugerenciaPendiente }) {
  const router = useRouter()
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resolver(accion: 'aprobar' | 'rechazar' | 'fusionar', itemDestino?: string) {
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('resolver_sugerencia', {
      p_sugerencia_id: sugerencia.id,
      p_accion: accion,
      p_item_destino: itemDestino ?? null,
      p_nota: nota.trim() || null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="mt-3 space-y-3">
      {sugerencia.parecidos.length > 0 ? (
        <div className="rounded-lg border border-enlace/25 bg-accent p-3">
          <p className="text-sm font-medium text-accent-foreground">
            Ya existe algo parecido
          </p>
          <div className="mt-2 space-y-2">
            {sugerencia.parecidos.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                className="h-11 w-full justify-start text-sm"
                disabled={enviando}
                onClick={() => resolver('fusionar', p.id)}
              >
                <Merge className="size-4" aria-hidden="true" />
                Fusionar con «{p.nombre}»
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nada parecido en el catálogo.</p>
      )}

      <div>
        <Label htmlFor={`nota-${sugerencia.id}`} className="text-sm">
          Nota (opcional)
        </Label>
        <Input
          id={`nota-${sugerencia.id}`}
          className="mt-1 h-11 text-sm"
          maxLength={300}
          value={nota}
          disabled={enviando}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Por qué tomaste esta decisión"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="h-11 flex-1 text-sm"
          disabled={enviando}
          onClick={() => resolver('aprobar')}
        >
          {enviando ? 'Guardando…' : 'Aprobar nuevo'}
        </Button>
        <Button
          variant="ghost"
          className="h-11 text-sm"
          disabled={enviando}
          onClick={() => resolver('rechazar')}
        >
          Rechazar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
