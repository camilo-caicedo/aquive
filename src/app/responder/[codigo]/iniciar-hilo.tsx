'use client'

import type { ReactNode } from 'react'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validarMensaje } from '@/lib/validacion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * La puerta del Flujo 2 para quien ofrece (§8-F5).
 *
 * Antes del primer mensaje hay que decirle tres cosas, y las tres están
 * arriba en la pantalla: que la entrega es en el acopio de la fundación,
 * que allá le van a pedir su documento, y cuánto vive ese dato.
 *
 * No se piden datos aquí. El documento se lo pide la fundación en el
 * acopio: la plataforma no lo necesita para abrir un hilo.
 */
export function IniciarHilo({ codigo, aviso }: { codigo: string; aviso?: ReactNode }) {
  const router = useRouter()
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function iniciar() {
    const problema = validarMensaje(mensaje)
    if (problema) {
      setError(problema)
      return
    }
    if (mensaje.trim().length < 10) {
      setError('Cuenta en una línea qué puedes llevar. Mínimo 10 caracteres.')
      return
    }

    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('iniciar_conversacion', {
      p_codigo: codigo,
      p_mensaje: mensaje.trim(),
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    router.push('/aliado?hilos=1')
    router.refresh()
  }

  return (
    <div className="mt-4 space-y-3">
      <Textarea
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Qué puedes llevar y cuándo. Ej: tengo tres mercados completos y puedo llevarlos el sábado."
        aria-label="Primer mensaje"
      />
      <p className="text-sm text-muted-foreground">
        No escribas tu teléfono ni tu correo: aquí la coordinación ocurre
        dentro de la plataforma, con la fundación presente.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {aviso}

      <Button
        className="w-full"
        disabled={enviando || mensaje.trim().length < 10}
        onClick={iniciar}
      >
        {enviando ? 'Abriendo…' : 'Ofrecer y abrir la conversación'}
      </Button>
    </div>
  )
}
