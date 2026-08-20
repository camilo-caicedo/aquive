import Link from 'next/link'
import { Flag, BadgeCheck, Lightbulb, PhoneCall } from 'lucide-react'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { origenDelSitio } from '@/lib/origen'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import { ENTIDADES_MATRICULA } from '@/lib/config'
import { categoria } from '@/lib/catalogo'
import { COLUMNAS_ENTIDAD_ADMIN } from '@/lib/types'
import type {
  EntidadMatricula,
  MotivoReporte,
  OrganizacionAdmin,
  PanelFlujo2,
  OrigenSugerencia,
  SugerenciaPendiente,
  TipoObjetoReporte,
  SolicitudAdmin,
} from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AccionesReporte } from './acciones-reporte'
import { AccionesServidor } from './acciones-servidor'
import { AccionesSugerencia } from './acciones-sugerencia'
import { PanelEntidades, type EntidadAdmin } from './panel-entidades'
import { PanelOrganizaciones } from './panel-organizaciones'
import { PanelFlujoDos } from './panel-flujo2'
import { Pestanas } from '@/components/pestanas'
import { ColaTrabajo } from './cola-trabajo'
import { PanelSolicitudesAdmin } from './panel-solicitudes-admin'
import {
  PanelServicios,
  type PanelServiciosDatos,
  type AccesoAReferencia,
} from './panel-servicios'
import type { ZonaPropuesta } from '@/components/panel-zonas'

const MOTIVOS: Record<MotivoReporte, string> = {
  datos_personales: 'Datos personales',
  estafa: 'Estafa',
  contenido_ofensivo: 'Contenido ofensivo',
  informacion_falsa: 'Información falsa',
  menor_de_edad: 'Menor de edad',
  extorsion_resena: 'Amenaza con una calificación',
  discriminacion: 'Discriminación',
  otro: 'Otro',
}

const TIPOS_OBJETO: Record<TipoObjetoReporte, string> = {
  solicitud: 'Solicitud',
  respuesta: 'Respuesta',
  perfil: 'Perfil',
  entidad: 'Entidad del directorio',
  proveedor: 'Ficha de servicios',
  resena: 'Calificación',
}

const ORIGENES_SUGERENCIA: Record<OrigenSugerencia, string> = {
  solicitante: 'Quien pidió ayuda',
  ofertador: 'Quien ofreció ayuda',
  aliado: 'Aliado',
}

function etiquetaEntidad(valor: EntidadMatricula) {
  return ENTIDADES_MATRICULA.find((e) => e.valor === valor)?.etiqueta ?? valor
}

function fecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Vista =
  | 'moderacion'
  | 'catalogo'
  | 'directorio'
  | 'aliados'
  | 'solicitudes'
  | 'servicios'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; cola?: string }>
}) {
  const { ver, cola } = await searchParams
  const vista: Vista =
    ver === 'catalogo' ||
    ver === 'directorio' ||
    ver === 'aliados' ||
    ver === 'solicitudes' ||
    ver === 'servicios'
      ? ver
      : 'moderacion'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: admin } = await supabase
    .from('administradores')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  // Sin pistas de qué hay detrás: mismo mensaje para cualquiera que no sea admin.
  if (!admin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <p className="text-base">No tienes acceso a esta página.</p>
      </main>
    )
  }

  // `perfiles` va en consulta aparte, no embebida: los tipos escritos a mano de
  // src/lib/types.ts declaran `Relationships: []`, así que PostgREST no puede
  // resolver `servidores -> perfiles` a nivel de tipos.
  const [{ count: nReportes }, { count: nMatriculas }] = await Promise.all([
    supabase.from('reportes').select('id', { count: 'exact', head: true }).eq('atendido', false),
    supabase.from('servidores').select('perfil_id', { count: 'exact', head: true }).eq('verificado', false),
  ])

  const enModeracion = vista === 'moderacion'
  // «Pendientes» reúne las cuatro colas de trabajo; «Catálogos», lo que se
  // consulta y se edita. Seis pestañas de igual peso obligaban a entrar en
  // cada una para saber si tenía algo.
  const enPendientes =
    vista === 'moderacion' || vista === 'catalogo' || vista === 'servicios'
  const [
    { data: reportes },
    { data: servidores },
    { data: perfiles },
    { data: sugerenciasData },
    { data: entidadesData },
    { data: organizacionesData },
    { data: flujo2Data },
    { data: solicitudesData },
    { data: serviciosData },
    { data: accesosRefData },
    { data: zonasPropData },
  ] = await Promise.all([
    enModeracion
      ? supabase
          .from('reportes')
          .select('*')
          .eq('atendido', false)
          .order('creado_at', { ascending: false })
      : Promise.resolve({ data: null }),
    enModeracion
      ? supabase.from('servidores').select('*').eq('verificado', false)
      : Promise.resolve({ data: null }),
    // Sin filtrar por tipo: el vínculo real es servidores.perfil_id, y si
    // el tipo del perfil no coincidiera, la cola mostraría "Perfil sin
    // nombre" y el administrador no sabría a quién está verificando.
    enModeracion
      ? supabase.from('perfiles').select('id, nombre_visible, municipios, suspendido')
      : Promise.resolve({ data: null }),
    vista === 'catalogo' || enPendientes
      ? supabase.rpc('sugerencias_pendientes')
      : Promise.resolve({ data: null }),
    // Columnas explícitas: `select('*')` arrastraría `creada_por`, el uuid
    // de `auth.users` de quien dio de alta la entidad.
    vista === 'directorio'
      ? supabase.from('entidades').select(COLUMNAS_ENTIDAD_ADMIN).order('orden').order('nombre')
      : Promise.resolve({ data: null }),
    // Por RPC y no por `select`: la tabla está revocada entera, y así
    // `creada_por` —el uuid de una persona real— no sale al navegador.
    vista === 'aliados' ? supabase.rpc('organizaciones_admin') : Promise.resolve({ data: null }),
    vista === 'aliados' ? supabase.rpc('panel_admin_flujo2') : Promise.resolve({ data: null }),
    // Por RPC y no por la vista publica: el panel tiene que seguir viendo
    // las que acaba de cerrar, y esas ya no salen en el tablero.
    vista === 'solicitudes' ? supabase.rpc('solicitudes_admin') : Promise.resolve({ data: null }),
    // Las tres colas del módulo de Servicios en una llamada, y la bitácora
    // de lecturas de referencias en otra: la segunda solo se dibuja si el
    // administrador la abre, pero traerla ya evita un viaje más.
    vista === 'servicios' || enPendientes
      ? supabase.rpc('panel_admin_servicios')
      : Promise.resolve({ data: null }),
    vista === 'servicios'
      ? supabase.rpc('accesos_a_referencias')
      : Promise.resolve({ data: null }),
    vista === 'servicios'
      ? supabase.rpc('zonas_propuestas')
      : Promise.resolve({ data: null }),
  ])

  const solicitudes = (solicitudesData as unknown as SolicitudAdmin[]) ?? []

  const sugerencias = (sugerenciasData as unknown as SugerenciaPendiente[]) ?? []
  const entidades: EntidadAdmin[] = entidadesData ?? []
  const organizaciones = (organizacionesData as unknown as OrganizacionAdmin[]) ?? []
  const flujo2 = flujo2Data as unknown as PanelFlujo2 | null
  const servicios = serviciosData as unknown as PanelServiciosDatos | null
  const telefonosPorLlamar = servicios?.por_verificar.length ?? 0
  const accesosRef = (accesosRefData as unknown as AccesoAReferencia[]) ?? []
  const zonasProp = (zonasPropData as unknown as ZonaPropuesta[]) ?? []

  const porPerfil = new Map((perfiles ?? []).map((p) => [p.id, p]))

  // El código DANE no le dice nada a quien está verificando una matrícula.
  const municipios =
    vista === 'aliados' || vista === 'directorio' || enModeracion
      ? await listarMunicipios(supabase)
      : []
  const origen = await origenDelSitio()
  const nombreMunicipio = mapaDeNombres(municipios ?? [])

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Administración" volver="/">
      <div className="mt-3">
        <Pestanas
          etiqueta="Secciones de administración"
          pestanas={[
            {
              href: '/admin',
              etiqueta: 'Pendientes',
              activa: enPendientes,
              cuenta:
                (nReportes ?? 0) + (nMatriculas ?? 0) + sugerencias.length + telefonosPorLlamar,
            },
            {
              href: '/admin?ver=directorio',
              etiqueta: 'Catálogos',
              activa: !enPendientes,
            },
          ]}
        />
      </div>
      </CabeceraPantalla>

      {enPendientes && (
        <ColaTrabajo
          colas={[
            {
              href: '/admin',
              Icono: Flag,
              etiqueta: 'Reportes',
              detalle: 'Contenido que alguien marcó como problemático',
              cuantas: nReportes ?? 0,
              activa: vista === 'moderacion' && cola !== 'matriculas',
            },
            {
              href: '/admin?cola=matriculas',
              Icono: BadgeCheck,
              etiqueta: 'Matrículas por verificar',
              detalle: 'Comprobar el número en el registro de la entidad',
              cuantas: nMatriculas ?? 0,
              activa: vista === 'moderacion' && cola === 'matriculas',
            },
            {
              href: '/admin?ver=catalogo',
              Icono: Lightbulb,
              etiqueta: 'Ítems sugeridos',
              detalle: 'Aprobar, fusionar o rechazar lo que la gente propuso',
              cuantas: sugerencias.length,
              activa: vista === 'catalogo',
            },
            {
              href: '/admin?ver=servicios',
              Icono: PhoneCall,
              etiqueta: 'Teléfonos por llamar',
              detalle: 'Proveedores esperando que alguien verifique su número',
              cuantas: telefonosPorLlamar,
              activa: vista === 'servicios',
            },
          ]}
        />
      )}

      {/* Las otras tres secciones no son colas: se consultan. Van en chips
          para no volver a tener seis pestañas de igual peso. */}
      {!enPendientes && (
        <nav aria-label="Qué catálogo ver" className="riel -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
          {[
            { href: '/admin?ver=directorio', etiqueta: 'Entidades', clave: 'directorio' },
            { href: '/admin?ver=solicitudes', etiqueta: 'Solicitudes', clave: 'solicitudes' },
            { href: '/admin?ver=aliados', etiqueta: 'Organizaciones', clave: 'aliados' },
          ].map((c) => (
            <Link
              key={c.clave}
              href={c.href}
              aria-current={vista === c.clave ? 'page' : undefined}
              className={`inline-flex min-h-12 shrink-0 items-center rounded-full border px-4 text-base transition-colors ${
                vista === c.clave
                  ? 'border-border bg-card font-semibold text-foreground shadow-sm'
                  : 'border-transparent text-muted-foreground hover:bg-muted'
              }`}
            >
              {c.etiqueta}
            </Link>
          ))}
        </nav>
      )}

      {enModeracion && cola !== 'matriculas' && (
        <>
      <section className="mt-6">
        {!reportes || reportes.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border p-6 text-center text-base text-muted-foreground">
            No hay reportes pendientes.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reportes.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-lg font-bold">{MOTIVOS[r.motivo]}</span>
                  <span className="text-base text-muted-foreground">
                    {fecha(r.creado_at)}
                  </span>
                </div>
                <p className="mt-1 text-base text-muted-foreground">
                  {TIPOS_OBJETO[r.tipo_objeto]} · {r.objeto_id}
                </p>
                {r.nota && <p className="mt-2 text-base">{r.nota}</p>}
                <AccionesReporte reporteId={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      </>
      )}

      {enModeracion && cola === 'matriculas' && (
        <>
      <section className="mt-6">
        <details className="group mt-3">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-base text-primary underline [&::-webkit-details-marker]:hidden">
            Cómo se verifica
          </summary>
          <p className="mt-1 text-base text-muted-foreground">
            Consulta el número en el registro de la entidad antes de marcarlo
            como verificado. Verificar solo dice que el número aparece ahí.
          </p>
        </details>
        {!servidores || servidores.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border p-6 text-center text-base text-muted-foreground">
            No hay matrículas pendientes.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {servidores.map((s) => {
              const perfil = porPerfil.get(s.perfil_id)
              return (
                <li key={s.perfil_id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-lg font-bold">
                      {perfil?.nombre_visible ?? 'Perfil sin nombre'}
                    </span>
                    {perfil?.suspendido && (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-primary/25 bg-accent px-2.5 py-0.5 text-base font-medium text-accent-foreground">
                        Suspendido
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-base">{s.profesion}</p>
                  <p className="mt-1 text-base text-muted-foreground">
                    {etiquetaEntidad(s.entidad_matricula)} · Matrícula{' '}
                    {s.numero_matricula}
                  </p>
                  {perfil && perfil.municipios.length > 0 && (
                    <p className="mt-1 text-base text-muted-foreground">
                      Municipios:{' '}
                      {perfil.municipios
                        .map((c) => nombreMunicipio.get(c) ?? c)
                        .join(', ')}
                    </p>
                  )}
                  <AccionesServidor perfilId={s.perfil_id} />
                </li>
              )
            })}
          </ul>
        )}
      </section>
        </>
      )}

      {vista === 'catalogo' && (
      <section className="mt-6">
        <h2 className="font-heading text-2xl">Ítems sugeridos</h2>
        <details className="group mt-3">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-base text-primary underline [&::-webkit-details-marker]:hidden">
            Cómo se verifica
          </summary>
          <p className="mt-1 text-base text-muted-foreground">
            Aprobar crea un ítem nuevo en el catálogo. Fusionar reutiliza uno
            que ya existe y hace que todo lo que ya usaba esta sugerencia
            apunte a ese ítem. Rechazar no crea ni cambia nada.
          </p>
        </details>
        {sugerencias.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border p-6 text-center text-base text-muted-foreground">
            No hay ítems sugeridos por revisar.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {sugerencias.map((s) => (
              <li key={s.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-lg font-bold">{s.nombre_propuesto}</span>
                  <span className="text-base text-muted-foreground">
                    {fecha(s.creada_at)}
                  </span>
                </div>
                <p className="mt-1 text-base text-muted-foreground">
                  {s.categoria_sugerida
                    ? categoria(s.categoria_sugerida).etiqueta
                    : 'Sin categoría sugerida'}{' '}
                  · {ORIGENES_SUGERENCIA[s.origen]}
                </p>
                <p className="mt-1 text-base text-muted-foreground">
                  En uso en {s.usos} {s.usos === 1 ? 'solicitud u oferta' : 'solicitudes u ofertas'}
                </p>
                <AccionesSugerencia sugerencia={s} />
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {vista === 'directorio' && (
      <section className="mt-6">
        <h2 className="font-heading text-2xl">Entidades</h2>
        <details className="group mt-3">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-base text-primary underline [&::-webkit-details-marker]:hidden">
            Cómo se verifica
          </summary>
          <p className="mt-1 text-base text-muted-foreground">
            Aparecer en este directorio no es una recomendación de AquíVe:
            solo dice que la organización existe. Antes de enlazar a un
            sitio, revisa dos cosas: que no sea una página de donación de un
            tercero —el plan Hobby de Vercel las cuenta como uso comercial— y
            que enlazarla no sea una forma de dar, por otra vía, algo que el
            alcance cerrado prohíbe (alojamiento, transporte de personas,
            dinero).
          </p>
        </details>
        <PanelEntidades entidades={entidades} municipios={municipios} />
      </section>
      )}

      {vista === 'solicitudes' && (
      <section className="mt-6">
        <h2 className="font-heading text-2xl">Solicitudes vivas</h2>
        <details className="group mt-3">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-base text-primary underline [&::-webkit-details-marker]:hidden">
            Cómo se verifica
          </summary>
          <p className="mt-1 text-base text-muted-foreground">
            Si sabes por fuera que algo ya se entregó, dilo aquí: sale en el
            tablero y evita que otras tres personas se movilicen por lo mismo.
            Marcarla entregada la saca del tablero pero <strong>no la
            borra</strong> — quien pidió conserva su enlace y sus respuestas, y
            se borra sola a las 72 horas como todas.
          </p>
        </details>
        <PanelSolicitudesAdmin solicitudes={solicitudes} />
      </section>
      )}

      {vista === 'aliados' && (
      <section className="mt-6">
        <h2 className="font-heading text-2xl">Organizaciones aliadas</h2>
        <details className="group mt-3">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-base text-primary underline [&::-webkit-details-marker]:hidden">
            Cómo se verifica
          </summary>
          <p className="mt-1 text-base text-muted-foreground">
            Una organización aliada coordina entregas dentro de AquíVe, así
            que aquí no basta con que exista: mira el certificado del RUES y
            el NIT antes de crearla. No hay cola de verificación porque la
            verificación ocurre afuera, y eres tú.
            <br />
            Crearla no le da acceso a nadie. Genera después la invitación de
            coordinador y pásale el enlace a la persona de contacto: quien lo
            abra e inicie sesión queda como su primer coordinador, y de ahí
            en adelante el equipo lo arma la organización.
          </p>
        </details>
        <PanelOrganizaciones
          organizaciones={organizaciones}
          municipios={municipios}
          origen={origen}
        />
      </section>
      )}

      {vista === 'aliados' && flujo2 && (
        <section className="mt-6">
          {/* Primero, no al final: si hay hilos sin fundación hay dos
              personas esperando a que alguien decida. */}
          <h2 className="font-heading text-2xl">Acompañamiento</h2>
          <Alert className="mt-3">
            <AlertDescription>
              La bitácora dice quién vio una identidad, cuándo y con qué
              motivo — nunca qué vio. Es la evidencia de diligencia frente a
              la fundación y frente a la SIC, y sobrevive al borrado de la
              identidad que registra.
            </AlertDescription>
          </Alert>
          <PanelFlujoDos datos={flujo2} />
        </section>
      )}

      {vista === 'servicios' && servicios && (
        <PanelServicios datos={servicios} accesos={accesosRef} zonas={zonasProp} />
      )}
    </main>
  )
}
