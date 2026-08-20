import Link from 'next/link'
import { Plus } from 'lucide-react'
import { AccionPrincipal } from '@/components/accion-principal'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { ChevronRight, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PestanasLoMio } from '@/components/pestanas-lo-mio'
import { ListaLocal } from './lista-local'

export const metadata = { title: 'Lo mío' }

function Fila({ href, etiqueta, detalle }: { href: string; etiqueta: string; detalle: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
    >
      <span>
        <span className="block text-base font-medium">{etiqueta}</span>
        <span className="block text-sm text-muted-foreground">{detalle}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

export default async function MisSolicitudesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()


  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      {/* El h1 repite la etiqueta de la barra (regla 8): quien tocó «Lo
          mío» tiene que aterrizar en algo que se llame igual. */}
      <CabeceraPantalla titulo="Lo mío">
        <PestanasLoMio activa="solicitudes" conSesion={!!user} />
      </CabeceraPantalla>

      {/* En tarjeta y con icono, no como párrafo suelto: es lo único que
          hay que entender de esta pantalla, y de ello depende que la persona
          guarde el enlace antes de perderlo. */}
      <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4 text-secondary-foreground">
        <Smartphone className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
        <p className="text-base">
          Estas solicitudes viven solo en este teléfono. Si lo cambias o borras
          los datos del navegador, se pierden: guarda el enlace de cada una.
        </p>
      </div>
      <ListaLocal />

      {/* La fila hacia /aliado se fue: desde que hay celda propia en la
          barra, tenerla también aquí eran dos puertas al mismo cuarto —lo
          mismo que le pasaba a «Mi perfil» en el encabezado—. */}
      <nav aria-label="Lo mío" className="mt-8 flex flex-col gap-2">
        {!user && (
          <Fila
            href="/login"
            etiqueta="Entrar para ofrecer ayuda"
            detalle="Solo hace falta cuenta para ofrecer, no para pedir"
          />
        )}
      </nav>
      <AccionPrincipal etiqueta="Necesito ayuda" Icono={Plus} href="/publicar" />
    </main>
  )
}
