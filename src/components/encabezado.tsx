import Link from 'next/link'
import { MapPin, HandHeart, Stethoscope, ListChecks } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

const ENLACES = [
  { href: '/', etiqueta: 'Solicitudes', Icono: HandHeart },
  { href: '/servidores', etiqueta: 'Profesionales', Icono: Stethoscope },
  { href: '/mis-solicitudes', etiqueta: 'Mis solicitudes', Icono: ListChecks },
]

export async function Encabezado() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

      {/* Navegación con scroll horizontal: en pantallas de 320px no caben
          tres pestañas sin encogerlas por debajo del mínimo táctil. */}
      <nav aria-label="Secciones" className="mx-auto max-w-3xl overflow-x-auto px-4">
        <ul className="flex gap-1 pb-1">
          {ENLACES.map(({ href, etiqueta, Icono }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-lg px-3 text-base text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icono className="size-4" aria-hidden="true" />
                {etiqueta}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
