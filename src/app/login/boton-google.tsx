'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function BotonGoogle() {
  const [entrando, setEntrando] = useState(false)

  async function entrar() {
    setEntrando(true)
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
