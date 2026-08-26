'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Borrar la ficha del directorio, sin borrar la cuenta.
 *
 * Son dos cosas distintas y las dos tienen que estar a un toque: la cuenta
 * es del módulo de emergencia y la ficha es del directorio de servicios,
 * con otro responsable del tratamiento. Antes esto vivía al final del
 * formulario largo de `/servicios/soy-proveedor`; con el formulario partido
 * por secciones se habría quedado sin puerta, y una salida de habeas data
 * que hay que buscar no es una salida.
 */
export function BorrarFicha() {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function borrar() {
    setBorrando(true)
    setError(null)
    const { error: rpcError } = await createClient().rpc('borrar_proveedor', {
      p_token: null,
    })
    if (rpcError) {
      setError(rpcError.message)
      setBorrando(false)
      return
    }
    router.push('/perfil')
    router.refresh()
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {confirmando ? (
        <div className="rounded-2xl bg-background p-4">
          <p className="text-base font-semibold">
            ¿Seguro? Se borran tu ficha, tus oficios, tus referencias cifradas y
            las calificaciones que te escribieron. Tu cuenta se queda.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-familia-rojo text-foreground hover:bg-familia-rojo/85"
              disabled={borrando}
              onClick={borrar}
            >
              Sí, borrar mi ficha
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="w-full bg-familia-rojo text-foreground hover:bg-familia-rojo/85 sm:w-auto"
          onClick={() => setConfirmando(true)}
        >
          <Trash2 className="size-5" aria-hidden="true" />
          Borrar mi ficha del directorio
        </Button>
      )}
    </div>
  )
}
