import { redirect } from 'next/navigation'
import { LogOut, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/**
 * Cerrar sesión, como una fila entera.
 *
 * ⚠ Sigue siendo un `<form>` con Server Action y no un `onClick`: se envía
 * como formulario normal, así que cerrar sesión funciona también con
 * JavaScript desactivado. Lo que cambia es que el botón ES la fila —icono,
 * título, explicación y flecha— en vez de un `<section>` con su propio
 * título encima de un botón suelto: dentro de la lista de ajustes, aquello
 * pintaba dos títulos superpuestos.
 */
export function CerrarSesion() {
  async function salir() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
  }

  return (
    <form action={salir}>
      <button
        type="submit"
        className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <LogOut className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium">Cerrar sesión</span>
          <span className="block text-sm text-muted-foreground">
            Sales en este teléfono. Tu perfil sigue publicado.
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </form>
  )
}
