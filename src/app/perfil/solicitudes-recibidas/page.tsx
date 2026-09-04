import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { servidor } from '@/orpc/local'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { ListaOrdenes } from './lista-ordenes'

export const metadata = { title: 'Solicitudes recibidas' }

/**
 * La bandeja del prestador (ADR 0015): las órdenes que le llegaron a su
 * ficha, con su estado y los botones para aceptarlas, rechazarlas o
 * cerrarlas.
 *
 * ⚠ Sin sesión rebota a `/login`, igual que el resto de `/perfil/*`
 * (`cargar.ts`). Sin ficha propia, `misOrdenes()` devuelve una lista vacía
 * —esta pantalla no comprueba eso aparte, porque el menú de `/perfil` ya
 * solo enseña esta fila a quien tiene ficha.
 */
export default async function SolicitudesRecibidasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ordenes = await servidor.servicios.misOrdenes()

  return (
    <main className="animar-pantalla mx-auto max-w-lg px-4 py-6">
      <CabeceraPantalla titulo="Solicitudes recibidas" volver="/perfil" />

      <p className="text-base text-muted-foreground">
        Lo que te pidieron desde tu ficha. Acéptalo o recházalo, y cuando
        termines el trabajo, ciérralo.
      </p>

      <ListaOrdenes ordenes={ordenes} />
    </main>
  )
}
