'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PackageCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * La segunda confirmación (§8-F8). La fundación registra lo que recibió;
 * esto es quien pidió diciendo que sí llegó.
 *
 * Dos confirmaciones y no una: con una sola, «entregado» sería la palabra
 * de una de las partes, y el registro que sobrevive al borrado valdría
 * bastante menos.
 */
export function ConfirmarRecepcion({
  token,
  conversacionId,
}: {
  token: string
  conversacionId: string
}) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    setEnviando(true)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('confirmar_recepcion', {
      p_token: token,
      p_conversacion_id: conversacionId,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    setListo(true)
    setEnviando(false)
    router.refresh()
  }

  if (listo) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-base text-foreground">
        <PackageCheck className="size-5 shrink-0" aria-hidden="true" />
        Confirmaste que recibiste. Gracias.
      </p>
    )
  }

  return (
    <div className="mt-2">
      <Button className="w-full" disabled={enviando} onClick={confirmar}>
        <PackageCheck className="size-5" aria-hidden="true" />
        {enviando ? 'Confirmando…' : 'Confirmar que sí recibí'}
      </Button>
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
