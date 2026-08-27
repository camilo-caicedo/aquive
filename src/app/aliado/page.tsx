import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { origenDelSitio } from '@/lib/origen'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import type { AliadoResumen } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pestanas } from '@/components/pestanas'
import { PanelEquipo } from './panel-equipo'
import { PanelProveedores, type ProveedorDeOrganizacion } from './panel-proveedores'
import { PanelReferencias, type ReferenciaPorRevisar } from './panel-referencias'
import { PanelZonas, type ZonaPropuesta } from '@/components/panel-zonas'
import { PanelEntregas } from './panel-entregas'
import { servidor } from '@/orpc/local'

export const metadata: Metadata = {
  title: 'Mi centro de acopio',
  robots: { index: false, follow: false },
}

// ⚠ El ADR 0008 pide tres pestañas: Entregas, Equipo y la ficha pública.
// Había dos, y faltaba justo la que ese ADR pone primera — «un centro de
// acopio registra lo que entra y lo que sale».
type Vista = 'entregas' | 'equipo' | 'proveedores'

/**
 * El panel de un centro de acopio (ADR 0008).
 *
 * ⚠ Antes esto era el panel de una fundación aliada, con las colas del
 * flujo acompañado: conversaciones de tres, coincidencias y solicitudes por
 * atender. Se fueron con el ADR 0007. Lo que queda es el trabajo de un
 * lugar físico: su equipo y las altas que hace de gente sin cuenta.
 *
 * ⚠ **Un admin entra sin ser miembro de ningún centro.** Es decisión del
 * responsable: los admins de la aplicación se encargan de todo a nivel
 * general, así que no puede haber una pantalla que se les cierre por no
 * pertenecer a una organización.
 *
 * Cada pestaña consulta lo suyo y nada más.
 */
export default async function AliadoPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; cola?: string }>
}) {
  const { ver } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: esAliado }, { data: admin }] = await Promise.all([
    supabase.rpc('soy_aliado'),
    supabase
      .from('administradores')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const esAdmin = Boolean(admin)
  if (!esAliado && !esAdmin) redirect('/')

  const vista: Vista =
    ver === 'proveedores' ? 'proveedores' : ver === 'equipo' ? 'equipo' : 'entregas'

  const { data: aliadoData } = await supabase.rpc('mi_aliado')
  const organizaciones = (aliadoData as unknown as AliadoResumen[]) ?? []

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      {/* El nombre de la organización, no «Mi organización»: quien
          coordina trabaja en una que se llama de alguna forma, y verla
          nombrada es lo que dice que está en el sitio correcto. */}
      {/* El nombre del centro, no «Mi centro»: quien atiende trabaja en
          uno que se llama de alguna forma, y verlo nombrado es lo que dice
          que está en el sitio correcto. */}
      <CabeceraPantalla
        titulo={organizaciones[0]?.organizacion.nombre ?? 'Centros de acopio'}
      >
        <div className="mt-3">
          <Pestanas
            etiqueta="Secciones del centro"
            pestanas={[
              { href: '/aliado', etiqueta: 'Entregas', activa: vista === 'entregas' },
              {
                href: '/aliado?ver=equipo',
                etiqueta: 'Mi equipo',
                activa: vista === 'equipo',
              },
              {
                href: '/aliado?ver=proveedores',
                etiqueta: 'Servicios',
                activa: vista === 'proveedores',
              },
            ]}
          />
        </div>
      </CabeceraPantalla>

      {esAdmin && !esAliado && (
        <p className="bg-accent text-accent-foreground mb-4 rounded-2xl p-4 text-base">
          Estás viendo esto como administrador. No perteneces a ningún centro
          de acopio, así que hay secciones que van a salir vacías.
        </p>
      )}

      {vista === 'entregas' && <Entregas organizaciones={organizaciones} />}

      {vista === 'proveedores' && <Proveedores />}

      {vista === 'equipo' && <Equipo organizaciones={organizaciones} miId={user.id} />}
    </main>
  )
}

/**
 * El directorio de servicios, desde el lado del centro: verificar teléfonos
 * llamando.
 *
 * ⚠ Registrar a quien no tiene cuenta de Google ya NO se hace aquí: con el
 * ADR 0006 eso crea una cuenta de verdad y vive en `/admin/cuentas`, que es
 * de admins. Aquí queda la verificación por llamada (regla de producto 6).
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

      <h3 className="font-heading mt-10 text-xl">Referencias por comprobar</h3>
      <p className="mt-1 text-base text-muted-foreground">
        Cada una es el contacto de alguien que no usa esta plataforma y que
        autorizó que lo llamaran una vez. Los datos se destapan de a uno, con
        motivo escrito, y cada lectura queda registrada.
      </p>
      <PanelReferencias
        referencias={(refs as unknown as ReferenciaPorRevisar[]) ?? []}
      />

      <h3 className="font-heading mt-10 text-xl">Zonas por revisar</h3>
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

/**
 * Lo que entra y lo que sale del centro. ADR 0008, decisión 2.
 *
 * Sección aparte y consultas propias, como `Equipo` y `Proveedores`: son
 * tres consultas que no tienen por qué hacerse cuando alguien entra a mirar
 * su equipo.
 */
async function Entregas({ organizaciones }: { organizaciones: AliadoResumen[] }) {
  const supabase = await createClient()
  const { data: organizacionId } = await supabase.rpc('mi_organizacion_activa')

  if (!organizacionId) {
    return (
      <p className="mt-6 text-base text-muted-foreground">
        Tu ingreso al equipo todavía está por aprobar.
      </p>
    )
  }

  const [municipios, { data: items }, movimientos] = await Promise.all([
    listarMunicipios(supabase),
    supabase.from('catalogo_items').select('*').eq('activo', true).order('orden'),
    servidor.acopios.movimientos({ organizacion_id: organizacionId as string }),
  ])

  // Solo los municipios donde ese centro opera: la lista completa de 1.122
  // no dice nada aquí, y anotar una entrega en un municipio donde el centro
  // no está es un dato que después nadie sabe leer.
  const suyos = organizaciones[0]?.organizacion.municipios ?? []
  const delCentro =
    suyos.length > 0
      ? municipios.filter((m) => suyos.includes(m.codigo_dane))
      : municipios

  return (
    <PanelEntregas
      organizacionId={organizacionId as string}
      municipios={delCentro}
      items={items ?? []}
      movimientos={movimientos}
    />
  )
}
