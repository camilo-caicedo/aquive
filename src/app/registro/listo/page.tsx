import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PackageOpen, HandHeart } from 'lucide-react'
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
    <MarcoFlujo titulo="Tu perfil quedó publicado" volver="/registro">
      <p className="text-base text-muted-foreground">
        Ya apareces en la lista de quién ofrece. Falta una cosa para que
        sirva de verdad.
      </p>

      <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="font-heading text-2xl">Que te avisemos</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Sin avisos tendrías que entrar a mirar el tablero cada rato para
          enterarte de que alguien de tus municipios pidió ayuda. Con ellos te
          llega solo.
        </p>
        <div className="mt-3">
          <AvisosOfertador municipios={perfil.municipios.length} />
        </div>
      </div>

      <h2 className="font-heading mt-8 text-2xl">Lo que sigue</h2>
      <ul className="mt-3 space-y-2">
        <li>
          <Link
            href="/registro"
            className="flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted"
          >
            <PackageOpen className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>
              <span className="block text-base font-medium">Contar qué tienes</span>
              <span className="block text-sm text-muted-foreground">
                Opcional. Sirve para que te encuentren por lo que puedes dar.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/"
            className="flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted"
          >
            <HandHeart className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>
              <span className="block text-base font-medium">
                Ver quién necesita ayuda
              </span>
              <span className="block text-sm text-muted-foreground">
                En tus municipios y en el resto del país.
              </span>
            </span>
          </Link>
        </li>
      </ul>

      <p className="mt-6 text-base text-muted-foreground">
        Tu perfil vive en «Lo mío», el cuarto botón de la barra de abajo.
      </p>
    </MarcoFlujo>
  )
}
