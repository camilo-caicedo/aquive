import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { origenDelSitio } from '@/lib/origen'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import type {
  AliadoResumen,
  Coincidencia,
  HiloResumen,
  SolicitudPorAtender,
} from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pestanas } from '@/components/pestanas'
import { PanelEquipo } from './panel-equipo'
import { PanelHilos } from './panel-hilos'
import { PanelCoincidencias } from './panel-coincidencias'
import { PanelSolicitudes } from './panel-solicitudes'
import { PanelProveedores, type ProveedorDeOrganizacion } from './panel-proveedores'
import { PanelReferencias, type ReferenciaPorRevisar } from './panel-referencias'
import { PanelZonas, type ZonaPropuesta } from '@/components/panel-zonas'

export const metadata: Metadata = {
  title: 'Mi organización',
  robots: { index: false, follow: false },
}

type Vista = 'conversaciones' | 'coincidencias' | 'equipo' | 'proveedores'

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
    ver === 'coincidencias' || ver === 'equipo' || ver === 'proveedores'
      ? ver
      : 'conversaciones'

  const [
    { data: hilosData },
    { data: cruceData },
    { data: ofrecidasData },
    { data: propiasData },
    { data: aliadoData },
  ] = await Promise.all([
    vista === 'conversaciones'
      ? supabase.rpc('mis_hilos')
      : Promise.resolve({ data: null }),
    vista === 'coincidencias' && esAliado
      ? supabase.rpc('coincidencias_para_aliado')
      : Promise.resolve({ data: null }),
    vista === 'coincidencias' && esAliado
      ? supabase.rpc('respuestas_por_coordinar')
      : Promise.resolve({ data: null }),
    vista === 'coincidencias' && esAliado
      ? supabase.rpc('solicitudes_de_mi_organizacion')
      : Promise.resolve({ data: null }),
    vista === 'equipo' && esAliado
      ? supabase.rpc('mi_aliado')
      : Promise.resolve({ data: null }),
  ])

  const hilos = (hilosData as unknown as HiloResumen[]) ?? []
  const coincidencias = (cruceData as unknown as Coincidencia[]) ?? []
  const yaOfrecieron = (ofrecidasData as unknown as Coincidencia[]) ?? []
  const propias = (propiasData as unknown as SolicitudPorAtender[]) ?? []
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
                etiqueta: 'Solicitudes por atender',
                activa: vista === 'coincidencias',
              },
              {
                href: '/aliado?ver=proveedores',
                etiqueta: 'Servicios',
                activa: vista === 'proveedores',
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
          {/* Lo primero, lo que la organización puede resolver sola: si está
              en la bodega no hay a quién esperar. Las otras dos secciones
              son para cuando lo tiene otra persona. */}
          <section className="mt-6">
            <h2 className="font-heading text-2xl">Puedes entregarlo tú</h2>
            <p className="mt-1 text-base text-muted-foreground">
              Solicitudes que acompaña tu organización. Si tienes esto en la
              bodega, abre la conversación y coordínalo directamente.
            </p>
            <PanelSolicitudes solicitudes={propias} />
          </section>

          {/* Primero quien YA se ofreció: es mejor señal que el cruce por
              inventario. Esa persona no solo tiene la cosa — ya dijo que
              quiere ayudar en esta solicitud concreta. Aparecen aquí
              porque respondieron antes de que se pidiera acompañamiento,
              así que su ofrecimiento se quedó fuera de la coordinación. */}
          {yaOfrecieron.length > 0 && (
            <section className="mt-8">
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

      {vista === 'proveedores' && esAliado && <Proveedores />}

      {vista === 'equipo' && <Equipo organizaciones={organizaciones} miId={user.id} />}
    </main>
  )
}

/**
 * El directorio de servicios, desde el lado de la fundación: registrar a
 * quien no tiene cuenta de Google y verificar teléfonos llamando.
 *
 * Sección aparte y consultas propias, como `Equipo`: son cuatro consultas
 * que no tienen por qué hacerse cuando alguien entra a leer un mensaje.
 */
async function Proveedores() {
  const supabase = await createClient()
  const [
    { data: lista },
    { data: oficios },
    { data: zonas },
    municipios,
    origen,
    { data: refs },
    { data: zonasProp },
  ] =
    await Promise.all([
      supabase.rpc('proveedores_de_mi_organizacion'),
      supabase.from('catalogo_oficios').select('*').eq('activo', true).order('orden'),
      supabase.from('zonas').select('*').eq('activa', true).order('orden'),
      listarMunicipios(supabase),
      origenDelSitio(),
      supabase.rpc('referencias_por_revisar'),
      supabase.rpc('zonas_propuestas'),
    ])

  const { data: organizacionId } = await supabase.rpc('mi_organizacion_activa')

  if (!organizacionId) {
    return (
      <p className="mt-6 text-base text-muted-foreground">
        Tu ingreso al equipo todavía está por aprobar.
      </p>
    )
  }

  return (
    <section>
      <h2 className="font-heading mt-6 text-2xl">Directorio de servicios</h2>
      <p className="mt-1 text-base text-muted-foreground">
        Aquí se registra a quien vive de su trabajo y no tiene cuenta de
        Google, y se verifican los teléfonos llamando. Es otra cosa que las
        entregas: estas fichas se publican en internet y no se borran solas.
      </p>

      <PanelProveedores
        organizacionId={organizacionId as string}
        proveedores={(lista as unknown as ProveedorDeOrganizacion[]) ?? []}
        municipios={municipios ?? []}
        oficios={oficios ?? []}
        zonas={zonas ?? []}
        origen={origen}
      />

      <h3 className="font-heading mt-10 text-2xl">Referencias por comprobar</h3>
      <p className="mt-1 text-base text-muted-foreground">
        Cada una es el contacto de alguien que no usa esta plataforma y que
        autorizó que lo llamaran una vez. Los datos se destapan de a uno, con
        motivo escrito, y cada lectura queda registrada.
      </p>
      <PanelReferencias
        referencias={(refs as unknown as ReferenciaPorRevisar[]) ?? []}
      />

      <h3 className="font-heading mt-10 text-2xl">Zonas por revisar</h3>
      <p className="mt-1 text-base text-muted-foreground">
        Barrios y veredas que escribió alguien al registrarse, en municipios
        que todavía no tienen comunas cargadas. Al aprobarlos quedan en el
        desplegable para los siguientes: el mapa lo construye quien vive ahí.
      </p>
      <PanelZonas zonas={(zonasProp as unknown as ZonaPropuesta[]) ?? []} />
    </section>
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
  const nombreMunicipio = mapaDeNombres(municipios)

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
