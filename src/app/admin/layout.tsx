import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * La puerta de administración, una sola vez para las nueve rutas.
 *
 * Antes la comprobación vivía dentro de `/admin/page.tsx`, que era también
 * las seis pestañas: partirlas en rutas propias habría significado repetir
 * este bloque nueve veces, y una comprobación de acceso repetida nueve
 * veces es una que algún día se olvida en la décima.
 *
 * ⚠ El mensaje es neutro a propósito y no cambia: decir «no eres
 * administrador» o «esa cola no existe» son dos formas de contar qué hay
 * detrás. Quien no tiene acceso ve lo mismo en las nueve rutas.
 *
 * Sin sesión rebota a /login, que es distinto: ahí todavía no hay nada que
 * ocultar, y mandar a alguien a leer «no tienes acceso» cuando lo único
 * que le falta es entrar sería un callejón.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: admin } = await supabase
    .from('administradores')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!admin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <p className="text-base">No tienes acceso a esta página.</p>
      </main>
    )
  }

  return <>{children}</>
}
