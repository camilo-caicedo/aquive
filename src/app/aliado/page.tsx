import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import type { AliadoResumen } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PanelEquipo } from './panel-equipo'

export const metadata: Metadata = {
  title: 'Mi organización · AquíVe',
  robots: { index: false, follow: false },
}

export default async function AliadoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: datos }, municipios] = await Promise.all([
    supabase.rpc('mi_aliado'),
    listarMunicipios(supabase),
  ])

  const organizaciones = (datos as unknown as AliadoResumen[]) ?? []
  const nombreMunicipio = new Map(municipios.map((m) => [m.codigo_dane, m.nombre]))

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading text-3xl">Mi organización</h1>

      {organizaciones.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-base text-muted-foreground">
          No perteneces a ninguna organización. Para entrar a una hace falta
          el enlace que reparte su coordinador.
        </p>
      ) : (
        organizaciones.map(({ organizacion, yo, equipo, invitaciones }) => (
          <section key={organizacion.id} className="mt-6">
            <h2 className="font-heading text-2xl">{organizacion.nombre}</h2>

            <p className="mt-2 flex items-center gap-1.5 text-base">
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {organizacion.municipios
                .map((c) => nombreMunicipio.get(c) ?? c)
                .join(', ')}
            </p>

            {organizacion.direccion_acopio && (
              <p className="mt-1 text-base text-muted-foreground">
                Acopio: {organizacion.direccion_acopio}
                {organizacion.horario_acopio && ` · ${organizacion.horario_acopio}`}
              </p>
            )}

            {!organizacion.activa && (
              <Alert variant="warning" className="mt-3">
                <AlertDescription>
                  Esta organización está suspendida. Mientras lo esté, nadie
                  de su equipo puede coordinar nada por aquí.
                </AlertDescription>
              </Alert>
            )}

            {yo.estado === 'pendiente' && (
              <Alert variant="warning" className="mt-3">
                <AlertDescription>
                  Tu ingreso está por aprobar. Hasta que un coordinador lo
                  apruebe no vas a ver nada de la organización. Si tienes el
                  enlace con código de invitación, ábrelo y entras de una vez.
                </AlertDescription>
              </Alert>
            )}

            {yo.estado === 'inactivo' && (
              <Alert variant="warning" className="mt-3">
                <AlertDescription>
                  Un coordinador te sacó del equipo. Si crees que es un error,
                  háblalo con la organización: desde aquí no hay nada que
                  hacer.
                </AlertDescription>
              </Alert>
            )}

            {yo.estado === 'activo' && (
              <>
                <p className="mt-3 text-base text-muted-foreground">
                  Estás como {yo.rol === 'coordinador' ? 'coordinador' : 'parte del equipo'}
                  {yo.puede_ver_identidad && ' · puedes ver identidades'}
                  {yo.puede_moderar && ' · puedes moderar'}
                </p>

                {yo.rol === 'coordinador' ? (
                  <PanelEquipo
                    organizacionId={organizacion.id}
                    slug={organizacion.slug}
                    miId={user.id}
                    equipo={equipo}
                    invitaciones={invitaciones}
                  />
                ) : (
                  <p className="mt-3 rounded-lg border border-dashed border-border p-6 text-center text-base text-muted-foreground">
                    Todavía no hay solicitudes coordinadas por aquí. Cuando las
                    haya, aparecerán en esta pantalla.
                  </p>
                )}
              </>
            )}
          </section>
        ))
      )}
    </main>
  )
}
