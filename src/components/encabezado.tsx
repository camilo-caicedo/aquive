import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Navegacion } from '@/components/navegacion'
import { BotonAvisos } from '@/components/boton-avisos'

export async function Encabezado() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Solo se consulta si hay sesión: para un visitante anónimo no tiene
  // sentido pagar las consultas en cada carga. La RLS de `administradores`
  // solo deja ver la propia fila, así que esto no revela quién más lo es.
  const [admin, perfil] = user
    ? await Promise.all([
        supabase.from('administradores').select('user_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('perfiles').select('id').eq('id', user.id).maybeSingle(),
      ])
    : [null, null]

  const esAdmin = !!admin?.data
  // El interruptor de avisos solo tiene sentido con perfil: los avisos
  // son de solicitudes en TUS municipios, y sin perfil no hay municipios.
  const tienePerfil = !!perfil?.data

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MapPin className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight">AquíVe</span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          {tienePerfil && <BotonAvisos />}
          <Button
            size="sm"
            className="h-11 px-3"
            nativeButton={false}
            render={<Link href={user ? '/registro' : '/login'} />}
          >
            {user ? 'Mi perfil' : 'Quiero ayudar'}
          </Button>
        </div>
      </div>

      <Navegacion esAdmin={esAdmin} />
    </header>
  )
}
