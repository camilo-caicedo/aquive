import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { origenDelSitio } from '@/lib/origen'
import { listarMunicipios } from '@/lib/municipios'
import type { AliadoResumen, Coincidencia, HiloResumen } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pestanas } from '@/components/pestanas'
import { PanelEquipo } from './panel-equipo'
import { PanelHilos } from './panel-hilos'
import { PanelCoincidencias } from './panel-coincidencias'

export const metadata: Metadata = {
  title: 'Mi organización',
  robots: { index: false, follow: false },
}

type Vista = 'conversaciones' | 'coincidencias' | 'equipo'

/**
 * Dos públicos en una sola ruta: el equipo de una fundación y quien
 * ofreció ayuda en una solicitud acompañada. El segundo no pertenece a
 * ninguna organización y aun así tiene hilos que leer.
 *
 * Por eso quien solo ofrece no ve pestañas: para él esto es una sola
 * pantalla, la de sus conversaciones. Una barra de navegación con una sola
 * opción no es navegación, es ruido.
 *
 * Cada pestaña consulta lo suyo y nada más. Antes se hacían las cuatro
 * consultas siempre, aunque solo se entrara a leer un mensaje.
 */
export default async function AliadoPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>
}) {
  const { ver } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: esAliado } = await supabase.rpc('soy_aliado')

  const vista: Vista =
    ver === 'coincidencias' || ver === 'equipo' ? ver : 'conversaciones'

  const [{ data: hilosData }, { data: cruceData }, { data: ofrecidasData }, { data: aliadoData }] =
    await Promise.all([
      vista === 'conversaciones'
        ? supabase.rpc('mis_hilos')
        : Promise.resolve({ data: null }),
      vista === 'coincidencias' && esAliado
        ? supabase.rpc('coincidencias_para_aliado')
        : Promise.resolve({ data: null }),
      vista === 'coincidencias' && esAliado
        ? supabase.rpc('respuestas_por_coordinar')
        : Promise.resolve({ data: null }),
      vista === 'equipo' && esAliado
        ? supabase.rpc('mi_aliado')
        : Promise.resolve({ data: null }),
    ])

  const hilos = (hilosData as unknown as HiloResumen[]) ?? []
  const coincidencias = (cruceData as unknown as Coincidencia[]) ?? []
  const yaOfrecieron = (ofrecidasData as unknown as Coincidencia[]) ?? []
  const organizaciones = (aliadoData as unknown as AliadoResumen[]) ?? []

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading text-3xl">
        {esAliado ? 'Mi organización' : 'Coordinación'}
      </h1>

      {esAliado && (
        <div className="mt-4">
          <Pestanas
            etiqueta="Secciones de tu organización"
            pestanas={[
              {
                href: '/aliado',
                etiqueta: 'Conversaciones',
                activa: vista === 'conversaciones',
              },
              {
                href: '/aliado?ver=coincidencias',
                etiqueta: 'Quién tiene lo que piden',
                activa: vista === 'coincidencias',
              },
              {
                href: '/aliado?ver=equipo',
                etiqueta: 'Mi equipo',
                activa: vista === 'equipo',
              },
            ]}
          />
        </div>
      )}

      {vista === 'conversaciones' && (
        <section className="mt-6">
          <PanelHilos hilos={hilos} />
          {!esAliado && hilos.length === 0 && (
            <p className="mt-3 text-base text-muted-foreground">
              Aquí aparecen las conversaciones de las solicitudes que una
              fundación acompaña. Para entrar al equipo de una organización
              hace falta el enlace que reparte su coordinador.
            </p>
          )}
        </section>
      )}

      {vista === 'coincidencias' && (
        <>
          {/* Primero quien YA se ofreció: es mejor señal que el cruce por
              inventario. Esa persona no solo tiene la cosa — ya dijo que
              quiere ayudar en esta solicitud concreta. Aparecen aquí
              porque respondieron antes de que se pidiera acompañamiento,
              así que su ofrecimiento se quedó fuera de la coordinación. */}
          {yaOfrecieron.length > 0 && (
            <section className="mt-6">
              <h2 className="font-heading text-2xl">Ya ofrecieron ayuda</h2>
              <p className="mt-1 text-base text-muted-foreground">
                Respondieron antes de que se pidiera acompañamiento, así que
                todavía no están en ninguna conversación.
              </p>
              <PanelCoincidencias coincidencias={yaOfrecieron} />
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-heading text-2xl">Quién tiene lo que piden</h2>
            <p className="mt-1 text-base text-muted-foreground">
              Gente de tus municipios que declaró tener justo lo que pide una
              solicitud acompañada.
            </p>
            <PanelCoincidencias coincidencias={coincidencias} />
          </section>
        </>
      )}

      {vista === 'equipo' && <Equipo organizaciones={organizaciones} miId={user.id} />}
    </main>
  )
}

/** La ficha de la organización y su equipo. Solo se arma en su pestaña. */
async function Equipo({
  organizaciones,
  miId,
}: {
  organizaciones: AliadoResumen[]
  miId: string
}) {
  const supabase = await createClient()
  const [municipios, origen] = await Promise.all([
    listarMunicipios(supabase),
    origenDelSitio(),
  ])
  const nombreMunicipio = new Map(municipios.map((m) => [m.codigo_dane, m.nombre]))

  return (
    <>
      {organizaciones.map(({ organizacion, yo, equipo, invitaciones }) => (
        <section key={organizacion.id} className="mt-6">
          <h2 className="font-heading text-2xl">{organizacion.nombre}</h2>

          <p className="mt-2 flex items-center gap-1.5 text-base">
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {organizacion.municipios.map((c) => nombreMunicipio.get(c) ?? c).join(', ')}
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
                Esta organización está suspendida. Mientras lo esté, nadie de
                su equipo puede coordinar nada por aquí.
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
                háblalo con la organización: desde aquí no hay nada que hacer.
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

              {yo.rol === 'coordinador' && (
                <PanelEquipo
                  organizacionId={organizacion.id}
                  slug={organizacion.slug}
                  origen={origen}
                  miId={miId}
                  equipo={equipo}
                  invitaciones={invitaciones}
                />
              )}
            </>
          )}
        </section>
      ))}
    </>
  )
}
