'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { guardarDestino } from '@/lib/destino'
import { Button } from '@/components/ui/button'

export function BotonGoogle({ destino }: { destino?: string }) {
  const [entrando, setEntrando] = useState(false)

  async function entrar() {
    setEntrando(true)
    // A dónde volver, guardado antes de salir. No viaja en la URL: ver
    // `src/lib/destino.ts` y la lista blanca del callback.
    if (destino) guardarDestino(destino)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setEntrando(false)
  }

  return (
    <Button className="w-full" disabled={entrando} onClick={entrar}>
      {entrando ? 'Abriendo Google…' : 'Continuar con Google'}
    </Button>
  )
}
