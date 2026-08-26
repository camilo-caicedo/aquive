import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PackageOpen, HandHeart, Check, BellRing, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { MarcoFlujo } from '@/components/marco-flujo'
import { AvisosOfertador } from '../avisos-ofertador'

export const metadata = { title: 'Tu perfil quedó publicado' }

/**
 * La pantalla de cierre de crear perfil.
 *
 * Antes se aterrizaba en `/registro?ver=ajustes&nuevo=1`: una pestaña de
 * ajustes con un bloque explicando por qué estabas ahí, junto a «cerrar
 * sesión» y «borrar mi perfil», que es lo último que le interesa a alguien
 * que acaba de crear uno.
 *
 * ⚠ Una sola acción: activar los avisos, con la razón antes del botón. Esa
 * decisión ya estaba tomada y se conserva —se pide aquí y no en el tablero
 * porque el permiso de notificación exige un gesto, un «Bloquear» es
 * permanente y solo hay un toque, que se gasta cuando la persona acaba de
 * decir que quiere ayudar—. En iPhone sin pantalla de inicio hay que
 * avisar antes de intentar, y de eso ya se encarga `ActivarAvisos`.
 */
export default async function ListoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('municipios')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil) redirect('/registro')

  return (
    <MarcoFlujo titulo="Listo" volver="/registro">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-ok-suave text-foreground"
      >
        <Check className="size-7" />
      </span>

      <h2 className="font-heading mt-4 text-3xl leading-tight">
        Tu perfil quedó publicado
      </h2>
      <p className="mt-2 text-base text-muted-foreground">
        Ya apareces en «Quién ofrece» y puedes responder solicitudes.
      </p>

      {/* La única acción de la pantalla, con la razón antes del botón. */}
      <div className="mt-6 rounded-2xl bg-accent p-4 text-accent-foreground">
        <p className="font-heading flex items-center gap-2 text-xl">
          <BellRing className="size-5 shrink-0" aria-hidden="true" />
          Falta lo que hace que sirva
        </p>
        <div className="mt-3">
          <AvisosOfertador municipios={perfil.municipios.length} />
        </div>
        <p className="mt-2 text-sm">
          Es por teléfono. Puedes apagarlos cuando quieras desde la campana.
        </p>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Lo que sigue</h2>
      <ul className="mt-3 space-y-2">
        {[
          {
            href: '/registro',
            Icono: PackageOpen,
            titulo: 'Cuéntanos qué tienes',
            detalle: 'Así apareces en las coincidencias. Opcional.',
          },
          {
            href: '/ayudas',
            Icono: HandHeart,
            titulo: 'Ver quién necesita ayuda',
            detalle: 'En tus municipios y en el resto del país.',
          },
        ].map((f) => (
          <li key={f.href}>
            <Link
              href={f.href}
              className="flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-canto transition-colors hover:bg-muted"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <f.Icono className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium">{f.titulo}</span>
                <span className="block text-sm text-muted-foreground">{f.detalle}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-base text-muted-foreground">
        Tu perfil vive en <strong className="font-semibold">Lo mío</strong>, en la
        barra de abajo. Ahí lo editas, cierras sesión o borras tu cuenta.
      </p>
    </MarcoFlujo>
  )
}
