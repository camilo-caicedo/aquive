'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function AccionesReporte({ reporteId }: { reporteId: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resolver(borrar: boolean) {
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('resolver_reporte', {
      p_reporte_id: reporteId,
      p_borrar: borrar,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="mt-3">
      {confirmando ? (
        <>
          <p className="text-base font-medium text-destructive">
            ¿Seguro? Esto borra el contenido para siempre. No se puede deshacer.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="destructive"
              disabled={enviando}
              onClick={() => resolver(true)}
            >
              {enviando ? 'Borrando…' : 'Sí, borrar para siempre'}
            </Button>
            <Button
              variant="outline"
              disabled={enviando}
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="destructive"
            disabled={enviando}
            onClick={() => setConfirmando(true)}
          >
            Borrar contenido
          </Button>
          <Button
            variant="outline"
            disabled={enviando}
            onClick={() => resolver(false)}
          >
            {enviando ? 'Guardando…' : 'Descartar reporte'}
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
