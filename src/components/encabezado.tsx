import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Marca } from '@/components/marca'
import { Button } from '@/components/ui/button'
import { Navegacion } from '@/components/navegacion'
import { BotonAvisos } from '@/components/boton-avisos'
import type { EstadoEncabezado } from '@/lib/types'

export async function Encabezado() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Solo se consulta si hay sesión: para un visitante anónimo no tiene
  // sentido pagar las consultas en cada carga. La RLS de `administradores`
  // solo deja ver la propia fila, así que esto no revela quién más lo es.
  const [admin, perfil, estado] = user
    ? await Promise.all([
        supabase.from('administradores').select('user_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('perfiles').select('id').eq('id', user.id).maybeSingle(),
        // Una sola consulta decide si se dibuja la pestaña de /aliado, cómo
        // se llama, y cuántos avisos hay sin ver. Empezó preguntando por
        // `tipo = 'aliado'` para ahorrarla, y la primera coordinadora de
        // verdad no encontró su panel; después salía solo para el equipo de
        // una fundación, y quien solo ofrece se quedó sin puerta a sus
        // conversaciones. Una consulta más por carga es más barata que una
        // persona que no encuentra dónde trabajar.
        supabase.rpc('estado_encabezado'),
      ])
    : [null, null, null]

  const esAdmin = !!admin?.data
  // La campana solo tiene sentido con perfil: los avisos son de hilos y
  // solicitudes donde participa una cuenta, y sin perfil no hay cuenta.
  const tienePerfil = !!perfil?.data
  const encabezado = (estado?.data as EstadoEncabezado | null) ?? null

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
        {/* El gato va suelto, sin caja: la identidad dice que no se encierra
            en un cuadro con borde cuando ya hay fondo. Antes había un
            alfiler de mapa aquí, y ese alfiler prometía un mapa que AquíVe
            no es. */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Marca className="size-9 text-primary" />
          <span className="font-heading text-2xl leading-none">AquíVe</span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          {tienePerfil && <BotonAvisos sinVer={encabezado?.avisos_sin_ver ?? 0} />}
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

      <Navegacion esAdmin={esAdmin} menuCoordinacion={encabezado?.coordinacion ?? null} />
    </header>
  )
}
