import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import { ENTIDADES_MATRICULA } from '@/lib/config'
import { categoria } from '@/lib/catalogo'
import type {
  EntidadMatricula,
  MotivoReporte,
  OrigenSugerencia,
  SugerenciaPendiente,
  TipoObjetoReporte,
} from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AccionesReporte } from './acciones-reporte'
import { AccionesServidor } from './acciones-servidor'
import { AccionesSugerencia } from './acciones-sugerencia'

const MOTIVOS: Record<MotivoReporte, string> = {
  datos_personales: 'Datos personales',
  estafa: 'Estafa',
  contenido_ofensivo: 'Contenido ofensivo',
  informacion_falsa: 'Información falsa',
  menor_de_edad: 'Menor de edad',
  otro: 'Otro',
}

const TIPOS_OBJETO: Record<TipoObjetoReporte, string> = {
  solicitud: 'Solicitud',
  respuesta: 'Respuesta',
  perfil: 'Perfil',
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

export default async function AdminPage() {
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
  const [
    { data: reportes },
    { data: servidores },
    { data: perfiles },
    { data: sugerenciasData },
  ] = await Promise.all([
    supabase
      .from('reportes')
      .select('*')
      .eq('atendido', false)
      .order('creado_at', { ascending: false }),
    supabase.from('servidores').select('*').eq('verificado', false),
    // Sin filtrar por tipo: el vínculo real es servidores.perfil_id, y si
    // el tipo del perfil no coincidiera, la cola mostraría "Perfil sin
    // nombre" y el administrador no sabría a quién está verificando.
    supabase.from('perfiles').select('id, nombre_visible, municipios, suspendido'),
    supabase.rpc('sugerencias_pendientes'),
  ])

  const sugerencias = (sugerenciasData as unknown as SugerenciaPendiente[]) ?? []

  const porPerfil = new Map((perfiles ?? []).map((p) => [p.id, p]))

  // El código DANE no le dice nada a quien está verificando una matrícula.
  const municipios = await listarMunicipios(supabase)
  const nombreMunicipio = new Map(
    (municipios ?? []).map((m) => [m.codigo_dane, m.nombre])
  )

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">Administración</h1>

      <section className="mt-6">
        <h2 className="text-xl font-bold">Reportes pendientes</h2>
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

      <section className="mt-8">
        <h2 className="text-xl font-bold">Matrículas por verificar</h2>
        <Alert className="mt-3">
          <AlertDescription>
            Consulta el número en el registro de la entidad antes de marcarlo
            como verificado. Verificar solo dice que el número aparece ahí.
          </AlertDescription>
        </Alert>
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
                      <span className="inline-flex shrink-0 items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-base font-medium text-amber-900">
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

      <section className="mt-8">
        <h2 className="text-xl font-bold">Ítems sugeridos</h2>
        <Alert className="mt-3">
          <AlertDescription>
            Aprobar crea un ítem nuevo en el catálogo. Fusionar reutiliza uno
            que ya existe y hace que todo lo que ya usaba esta sugerencia
            apunte a ese ítem. Rechazar no crea ni cambia nada.
          </AlertDescription>
        </Alert>
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
    </main>
  )
}
