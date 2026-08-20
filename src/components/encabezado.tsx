import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Marca } from '@/components/marca'
import { Button } from '@/components/ui/button'
import { BarraInferior, Navegacion } from '@/components/navegacion'
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
        // Queda por los avisos sin ver, que son lo que pinta la campana.
        // El `coordinacion` de esta misma consulta ya no decide ninguna
        // celda de la barra —la barra tiene cuatro y no cambia por rol—;
        // ahora lo consume «Lo mío», que es donde vive la puerta a
        // /aliado. Ver `src/app/mis-solicitudes/page.tsx`.
        supabase.rpc('estado_encabezado'),
      ])
    : [null, null, null]

  const esAdmin = !!admin?.data
  // La campana solo tiene sentido con perfil: los avisos son de hilos y
  // solicitudes donde participa una cuenta, y sin perfil no hay cuenta.
  const tienePerfil = !!perfil?.data
  const encabezado = (estado?.data as EstadoEncabezado | null) ?? null

  return (
    // Fragmento y no un solo `<header>`: la barra del teléfono es hermana
    // del encabezado, no hija. Dentro heredaría su `backdrop-blur`, que
    // convierte al encabezado en bloque contenedor de los descendientes
    // `fixed` y dejaría la barra pegada debajo del logo.
    <>
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
        {/* El gato va suelto, sin caja: la identidad dice que no se encierra
            en un cuadro con borde cuando ya hay fondo. Antes había un
            alfiler de mapa aquí, y ese alfiler prometía un mapa que AquíVe
            no es. */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Marca className="size-9 text-primary" />
          <span className="font-heading text-2xl leading-none">AquíVe</span>
        </Link>

        {/* Arriba solo queda la identidad y lo de la cuenta. «Mi perfil»
            se fue: era un destino, y los destinos están abajo —estaba en
            el encabezado y en la barra a la vez, dos puertas al mismo
            cuarto compitiendo por el sitio más caro de la pantalla—.
            Moderación se queda porque no es un destino del producto sino
            una herramienta de administrador. */}
        <div className="flex shrink-0 items-center gap-2">
          {esAdmin && (
            <Link
              href="/admin"
              aria-label="Moderación"
              title="Moderación"
              className="flex size-12 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ShieldCheck className="size-5" aria-hidden="true" />
            </Link>
          )}
          {tienePerfil && <BotonAvisos sinVer={encabezado?.avisos_sin_ver ?? 0} />}
          {/* Para quien no tiene sesión, y en `outline`: el relleno
              terracota es de la acción principal de la pantalla (regla 2),
              y entrar no lo es en ninguna. Va el último de la fila. */}
          {!user && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/login" />}
            >
              Entrar
            </Button>
          )}
        </div>
      </div>

      <Navegacion />
    </header>

    <BarraInferior />
    </>
  )
}
