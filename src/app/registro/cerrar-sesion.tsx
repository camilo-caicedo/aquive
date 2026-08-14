import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

// Server Action dentro de un <form>: se envía como formulario normal, así
// que cerrar sesión también funciona con JavaScript desactivado.
export function CerrarSesion() {
  async function salir() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
  }

  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="font-heading text-2xl">Cerrar sesión</h2>
      <p className="mt-2 text-base text-muted-foreground">
        Sales de tu cuenta en este teléfono. Tu perfil sigue publicado y
        puedes volver a entrar con Google cuando quieras.
      </p>
      <form action={salir}>
        <Button type="submit" variant="outline" className="mt-3 w-full sm:w-auto">
          <LogOut className="size-5" aria-hidden="true" />
          Cerrar sesión
        </Button>
      </form>
    </section>
  )
}
