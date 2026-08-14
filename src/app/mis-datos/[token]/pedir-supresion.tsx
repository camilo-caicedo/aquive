'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Artículo 15: el derecho de supresión. Borra la identidad, devuelve la
 * solicitud al flujo directo y cierra las conversaciones.
 *
 * Va detrás de una confirmación porque no se puede deshacer, pero no
 * detrás de fricción inventada: es un derecho, no un favor, y la solicitud
 * NO se pierde — sigue publicada, anónima, como cualquier otra.
 */
export function PedirSupresion({ token }: { token: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function suprimir() {
    setEnviando(true)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('suprimir_mis_datos', {
      p_token: token,
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
      <Alert className="mt-2">
        <AlertDescription>
          Listo. Borramos tu nombre, tu documento y tu teléfono, y cerramos
          las conversaciones. Tu solicitud sigue publicada, ahora sin ningún
          dato tuyo, hasta que venza o la cierres.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mt-2">
      <p className="text-base text-muted-foreground">
        Borramos tu nombre, tu documento y tu teléfono. Se cierran las
        conversaciones con la fundación y con quien ofrecía, y lo que
        escribiste en ellas se reemplaza. Tu solicitud sigue publicada,
        anónima.
      </p>

      {confirmando ? (
        <>
          <p className="mt-3 text-base font-medium text-destructive">
            ¿Seguro? Esto no se puede deshacer, y para volver a tener
            acompañamiento habría que darlos otra vez.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="destructive" disabled={enviando} onClick={suprimir}>
              {enviando ? 'Borrando…' : 'Sí, borra mis datos'}
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
        <Button variant="outline" className="mt-3 w-full" onClick={() => setConfirmando(true)}>
          Pedir que borren mis datos
        </Button>
      )}

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
