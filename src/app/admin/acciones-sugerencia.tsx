'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { SugerenciaPendiente } from '@/lib/types'

export function AccionesSugerencia({
  sugerencia,
}: {
  sugerencia: SugerenciaPendiente
}) {
  const router = useRouter()
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resolver(
    accion: 'aprobar' | 'rechazar' | 'fusionar',
    itemDestino?: string
  ) {
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
      {/* Los parecidos van primero y con su propio botón: si fusionar cuesta
          un clic más que aprobar, nadie los va a usar. */}
      {sugerencia.parecidos.length > 0 && (
        <div className="space-y-2">
          <p className="text-base font-medium">
            Ya existe algo parecido en el catálogo:
          </p>
          {sugerencia.parecidos.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              className="w-full justify-start"
              disabled={enviando}
              onClick={() => resolver('fusionar', p.id)}
            >
              Fusionar con &quot;{p.nombre}&quot;
            </Button>
          ))}
        </div>
      )}

      <div>
        <Label htmlFor={`nota-${sugerencia.id}`}>Nota (opcional)</Label>
        <Input
          id={`nota-${sugerencia.id}`}
          className="mt-1"
          maxLength={300}
          value={nota}
          disabled={enviando}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Por qué tomaste esta decisión"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button disabled={enviando} onClick={() => resolver('aprobar')}>
          {enviando ? 'Guardando…' : 'Aprobar como ítem nuevo'}
        </Button>
        <Button
          variant="destructive"
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
