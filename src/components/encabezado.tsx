import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Navegacion } from '@/components/navegacion'

export async function Encabezado() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Solo se consulta si hay sesión: para un visitante anónimo no tiene
  // sentido pagar la consulta en cada carga. La RLS de `administradores`
  // solo deja ver la propia fila, así que esto no revela quién más lo es.
  const esAdmin = user
    ? !!(
        await supabase
          .from('administradores')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle()
      ).data
    : false

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MapPin className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight">AquíVe</span>
        </Link>

        <Button
          size="sm"
          className="h-11 px-3"
          nativeButton={false}
          render={<Link href={user ? '/registro' : '/login'} />}
        >
          {user ? 'Mi perfil' : 'Quiero ayudar'}
        </Button>
      </div>

      <Navegacion esAdmin={esAdmin} />
    </header>
  )
}
