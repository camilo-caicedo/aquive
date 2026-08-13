'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function AccionesServidor({ perfilId }: { perfilId: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function verificar() {
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('verificar_servidor', {
      p_perfil_id: perfilId,
      p_verificado: true,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    router.refresh()
  }

  async function suspender() {
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('suspender_perfil', {
      p_perfil_id: perfilId,
      p_suspendido: true,
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
            ¿Seguro? El perfil deja de aparecer en la plataforma.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="destructive" disabled={enviando} onClick={suspender}>
              {enviando ? 'Suspendiendo…' : 'Sí, suspender perfil'}
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
          <Button disabled={enviando} onClick={verificar}>
            {enviando ? 'Guardando…' : 'Marcar matrícula verificada'}
          </Button>
          <Button
            variant="destructive"
            disabled={enviando}
            onClick={() => setConfirmando(true)}
          >
            Suspender perfil
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
