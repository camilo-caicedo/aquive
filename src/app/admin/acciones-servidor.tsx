'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Las dos decisiones de una matrícula: marcarla verificada o suspender el
 * perfil.
 *
 * ⚠ La confirmación en dos pasos de suspender no se toca, ni su frase: es
 * una acción que saca a una persona de la plataforma entera, y decirlo
 * antes de preguntar es la mitad del trato.
 *
 * `sinRegistro` es el caso de `ENTIDADES_MATRICULA = OTRA`. Ahí no hay
 * registro que consultar, así que no hay nada que verificar y el botón de
 * verificar no se dibuja: dejarlo sería ofrecer un sello que nadie puede
 * respaldar.
 */
export function AccionesServidor({
  perfilId,
  sinRegistro = false,
  suspendido = false,
}: {
  perfilId: string
  /** La entidad no tiene registro público consultable. */
  sinRegistro?: boolean
  suspendido?: boolean
}) {
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

  async function suspender(valor: boolean) {
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('suspender_perfil', {
      p_perfil_id: perfilId,
      p_suspendido: valor,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    router.refresh()
  }

  // Ya suspendido: la única salida es levantarla, y se dice qué significa
  // que lo esté.
  if (suspendido) {
    return (
      <div className="mt-3">
        <p className="text-sm text-muted-foreground">
          Mientras esté suspendida no aparece en la plataforma y no puede
          responder.
        </p>
        <Button
          variant="outline"
          className="mt-2 h-11 w-full text-sm"
          disabled={enviando}
          onClick={() => suspender(false)}
        >
          {enviando ? 'Guardando…' : 'Levantar la suspensión'}
        </Button>
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="mt-3">
      {confirmando ? (
        <>
          <p className="text-sm font-medium text-destructive">
            ¿Seguro? El perfil deja de aparecer en la plataforma.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="destructive"
              className="h-11 text-sm"
              disabled={enviando}
              onClick={() => suspender(true)}
            >
              {enviando ? 'Suspendiendo…' : 'Sí, suspender perfil'}
            </Button>
            <Button
              variant="outline"
              className="h-11 text-sm"
              disabled={enviando}
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {!sinRegistro && (
            <Button className="h-11 text-sm" disabled={enviando} onClick={verificar}>
              <BadgeCheck className="size-4" aria-hidden="true" />
              {enviando ? 'Guardando…' : 'Aparece: verificar'}
            </Button>
          )}
          <Button
            variant="outline"
            className="h-11 text-sm"
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
