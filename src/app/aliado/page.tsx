import Link from 'next/link'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
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
 * El panel de una fundación, y solo eso.
 *
 * ⚠ Antes esta ruta servía a dos públicos: el equipo de una organización y
 * quien ofreció ayuda en una solicitud acompañada. El segundo aterrizaba
 * en el panel de una fundación que no es la suya, con las colas de
 * `PanelHilos` —conceptos de quien coordina— y con la de por defecto
 * siempre vacía. Ahora se va a `/coordinacion`, que es una lista de sus
 * conversaciones y nada más.
 *
 * Cada pestaña consulta lo suyo y nada más. Antes se hacían las cuatro
 * consultas siempre, aunque solo se entrara a leer un mensaje.
 */
export default async function AliadoPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; cola?: string }>
}) {
  const { ver, cola } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: esAliado } = await supabase.rpc('soy_aliado')
  if (!esAliado) redirect('/coordinacion')

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

  const colaActiva =
    cola === 'ofrecieron' || cola === 'inventario' ? cola : 'propias'
  const COLAS = [
    { clave: 'propias', etiqueta: 'Puedes entregarlo tú', cuantas: propias.length },
    { clave: 'ofrecieron', etiqueta: 'Ya ofrecieron', cuantas: yaOfrecieron.length },
    { clave: 'inventario', etiqueta: 'Quién lo tiene', cuantas: coincidencias.length },
  ] as const

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      {/* El nombre de la organización, no «Mi organización»: quien
          coordina trabaja en una que se llama de alguna forma, y verla
          nombrada es lo que dice que está en el sitio correcto. */}
      <CabeceraPantalla
        titulo={
          esAliado ? (organizaciones[0]?.organizacion.nombre ?? 'Mi organización') : 'Coordinación'
        }
      >
      {esAliado && (
        <div className="mt-3">
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
      </CabeceraPantalla>

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
        <section className="mt-6">
          {/* Antes eran tres secciones apiladas con su título y su párrafo:
              para llegar a la tercera había que bajar dos pantallas, y las
              tres contestan la misma pregunta —quién puede resolver esto—.
              Ahora es una sola lista con chips que la acotan, y el chip
              lleva su número para no entrar a una cola vacía. */}
          <nav aria-label="Qué cola ver" className="riel -mx-4 flex gap-2 overflow-x-auto px-4">
            {COLAS.map(({ clave, etiqueta, cuantas }) => {
              const activa = colaActiva === clave
              return (
                <Link
                  key={clave}
                  href={clave === 'propias' ? '/aliado?ver=coincidencias' : `/aliado?ver=coincidencias&cola=${clave}`}
                  aria-current={activa ? 'page' : undefined}
                  className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-base transition-colors ${
                    activa
                      ? 'border-border bg-card font-semibold text-foreground shadow-sm'
                      : 'border-transparent text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {etiqueta}
                  <span className="rounded-full bg-muted px-2 text-sm text-muted-foreground">
                    {cuantas}
                  </span>
                </Link>
              )
            })}
          </nav>

          <p className="mt-3 text-base text-muted-foreground">
            {colaActiva === 'propias'
              ? 'Solicitudes que acompaña tu organización. Si tienes esto en la bodega, abre la conversación y coordínalo directamente.'
              : colaActiva === 'ofrecieron'
                ? 'Respondieron antes de que se pidiera acompañamiento, así que todavía no están en ninguna conversación.'
                : 'Gente de tus municipios que declaró tener justo lo que pide una solicitud acompañada.'}
          </p>

          {colaActiva === 'propias' && <PanelSolicitudes solicitudes={propias} />}
          {colaActiva === 'ofrecieron' && <PanelCoincidencias coincidencias={yaOfrecieron} />}
          {colaActiva === 'inventario' && <PanelCoincidencias coincidencias={coincidencias} />}
        </section>
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
