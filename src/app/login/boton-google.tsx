'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { guardarDestino } from '@/lib/destino'

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
    // Tarjeta blanca con sombra desplazada azul, no un relleno lima: el
    // botón lleva la G de Google, que es multicolor, y sobre lima se pelea
    // con ella. Además el lima de esta pantalla es la píldora de la marca.
    <button
      type="button"
      disabled={entrando}
      onClick={entrar}
      className="shadow-cartel-azul flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-card px-5 text-base font-semibold transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-60"
    >
      {/* La G oficial, dibujada. Un icono de lucide no es la marca de Google
          y su guía de marca no lo permite. */}
      <svg className="size-6 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      {entrando ? 'Abriendo Google…' : 'Continuar con Google'}
    </button>
  )
}
