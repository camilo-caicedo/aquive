import Link from 'next/link'
import { Info, Inbox, Building2, Stethoscope } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ENTIDADES_MATRICULA } from '@/lib/config'
import { enlaceWhatsapp } from '@/lib/contacto'
import { AVISO_CONTACTO, AVISO_CONTACTO_VERIFICADO, AVISO_ENTIDADES } from '@/lib/honestidad'
import { listarMunicipios } from '@/lib/municipios'
import { ListaEntidades } from './lista-entidades'
import { BotonReportar } from '@/components/boton-reportar'
import type { EntidadMatricula, AreaServicio } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SelectFiltro } from '@/components/select-filtro'

export const metadata = { title: 'Quién ofrece servicios · AquíVe' }

const AREAS: Record<AreaServicio, string> = {
  ingenieria: 'Ingeniería',
  arquitectura: 'Arquitectura',
  psicologia: 'Psicología',
  salud: 'Salud',
  derecho: 'Derecho',
}

function etiquetaEntidad(valor: EntidadMatricula) {
  return ENTIDADES_MATRICULA.find((e) => e.valor === valor)?.etiqueta ?? valor
}

export default async function ServidoresPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string; servicio?: string; ver?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Entidades es la pestaña por defecto: son las que el administrador
  // revisó una por una, y quien busca ayuda las lee primero.
  const verProfesionales = params.ver === 'profesionales'

  // El municipio entra en una cadena de filtros de PostgREST por
  // interpolación, así que se valida ANTES: un código DANE son cinco
  // dígitos y nada más. Sin esto, `?municipio=x},nombre.ilike.*a*,{y` mete
  // términos arbitrarios en el OR — hoy no hay columna oculta que sondear,
  // pero la habría el día que alguien agregue una a la vista, y ese día
  // nadie va a volver a mirar esta línea.
  const municipioCrudo = Array.isArray(params.municipio)
    ? params.municipio[0]
    : params.municipio
  const municipio =
    municipioCrudo && /^[0-9]{5}$/.test(municipioCrudo) ? municipioCrudo : null

  // Cada pestaña consulta lo suyo y nada más, igual que los dos modos de la
  // portada. Sin esto, entrar al directorio traía media base de datos.
  const [{ data: municipios }, { data: catalogoServicios }] = verProfesionales
    ? await Promise.all([
        supabase.from('municipios_con_servidores').select('*').order('nombre'),
        supabase.from('catalogo_servicios').select('*').eq('activo', true).order('orden'),
      ])
    : [{ data: null }, { data: null }]

  // El filtro por municipio devuelve las entidades locales de ese municipio
  // Y TODAS las nacionales: una entidad nacional también atiende ahí. Es lo
  // que más fácil se implementa mal.
  const consultaEntidades = supabase
    .from('entidades_publicas')
    .select('*')
    .order('orden')
    .order('nombre')

  const [{ data: entidades }, { data: municipiosEntidades }, todosLosMunicipios] =
    verProfesionales
      ? [{ data: null }, { data: null }, null]
      : await Promise.all([
          municipio
            ? consultaEntidades.or(`cobertura.eq.nacional,municipios.cs.{${municipio}}`)
            : consultaEntidades,
          supabase.from('municipios_con_entidades').select('*').order('nombre'),
          listarMunicipios(supabase),
        ])

  const nombreMunicipio = new Map(
    (todosLosMunicipios ?? []).map((m) => [m.codigo_dane, m.nombre])
  )

  const nombreServicio = new Map((catalogoServicios ?? []).map((s) => [s.id, s.nombre]))

  let query = supabase
    .from('servidores_publicos')
    .select('*')
    // Verificados primero: es el único dato comprobado que tenemos, no una recomendación.
    .order('verificado', { ascending: false })
    .order('nombre_visible')

  if (municipio) query = query.contains('municipios', [municipio])
  if (params.servicio) query = query.contains('servicios', [params.servicio])

  const { data: servidores } = verProfesionales ? await query : { data: null }
  const listaMunicipios = verProfesionales ? municipios : municipiosEntidades
  const hayFiltro = !!(municipio || (verProfesionales && params.servicio))
  const mostrarFiltros = (listaMunicipios?.length ?? 0) > 0 || hayFiltro

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">Quién ofrece servicios</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Organizaciones que prestan servicios, y profesionales con matrícula.
        El contacto ocurre por fuera: la plataforma no participa.
      </p>

      {/* Enlaces, no pestañas con estado: la pestaña vive en la URL, así
          que el enlace se puede compartir. Mismo patrón que los dos modos
          de la portada. */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Qué lista ver">
        <Link
          href="/servidores"
          aria-current={verProfesionales ? undefined : 'page'}
          className={`inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full border px-4 text-base transition-colors sm:flex-initial ${
            verProfesionales
              ? 'border-border bg-card hover:bg-muted'
              : 'border-primary bg-primary text-primary-foreground'
          }`}
        >
          <Building2 className="size-4 shrink-0" aria-hidden="true" />
          Entidades
        </Link>
        <Link
          href="/servidores?ver=profesionales"
          aria-current={verProfesionales ? 'page' : undefined}
          className={`inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full border px-4 text-base transition-colors sm:flex-initial ${
            verProfesionales
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card hover:bg-muted'
          }`}
        >
          <Stethoscope className="size-4 shrink-0" aria-hidden="true" />
          Profesionales
        </Link>
      </div>

      {/* Mismo criterio que el tablero: sin nadie registrado y sin filtros,
          los desplegables solo estorban. */}
      {mostrarFiltros && (
      <>
      <form
        method="get"
        className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row"
      >
        {/* Un GET reemplaza el query string entero: sin esto, filtrar te
            devuelve a la pestaña de entidades. */}
        {verProfesionales && <input type="hidden" name="ver" value="profesionales" />}
        <SelectFiltro
          name="municipio"
          label="Filtrar por municipio"
          placeholder="Todos los municipios"
          valorInicial={municipio ?? ''}
          conBusqueda
          opciones={(listaMunicipios ?? []).map((m) => ({
            valor: m.codigo_dane,
            etiqueta: m.nombre,
            detalle: m.departamento,
          }))}
        />
        {verProfesionales && (
        <SelectFiltro
          name="servicio"
          label="Filtrar por servicio"
          placeholder="Todos los servicios"
          valorInicial={params.servicio ?? ''}
          conBusqueda
          opciones={(catalogoServicios ?? []).map((s) => ({
            valor: s.id,
            etiqueta: s.nombre,
            detalle: AREAS[s.area],
          }))}
        />
        )}
        <Button type="submit" className="w-full sm:w-auto">
          Filtrar
        </Button>
      </form>

      {/* La lista de municipios está recortada a los que tienen a alguien
          registrado; si no se dice, parece que faltan municipios. */}
      <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
        <Info className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
        <span>
          {verProfesionales
            ? `La lista de municipios solo muestra los ${listaMunicipios?.length ?? 0} donde ya hay profesionales registrados. La de servicios los muestra todos, aunque nadie los ofrezca todavía.`
            : `La lista solo muestra los ${listaMunicipios?.length ?? 0} municipios con entidades locales. Las de cobertura nacional salen siempre, filtres por donde filtres.`}
        </span>
      </p>
      </>
      )}

      {!verProfesionales ? (
        <>
          <p className="mt-4 text-sm text-muted-foreground">{AVISO_ENTIDADES}</p>
          <ListaEntidades
            entidades={entidades ?? []}
            nombreMunicipio={nombreMunicipio}
          />
        </>
      ) : !servidores || servidores.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-base text-muted-foreground">
            {hayFiltro
              ? 'No hay profesionales registrados con estos filtros.'
              : 'Todavía no hay profesionales registrados. Si tienes matrícula, puedes ser el primero.'}
          </p>
          {hayFiltro ? (
            <Button
              variant="outline"
              className="mt-4"
              nativeButton={false}
              render={<Link href="/servidores" />}
            >
              Ver todos
            </Button>
          ) : (
            <Button className="mt-4" nativeButton={false} render={<Link href="/registro" />}>
              Ofrecer mis servicios
            </Button>
          )}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {servidores.map((s) => (
            <li key={s.id} className="rounded-lg border border-border p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-lg font-bold">{s.nombre_visible}</span>
                {s.verificado ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 text-sm font-medium text-green-900">
                    <span aria-hidden="true">✓</span> Matrícula verificada
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-sm font-medium text-amber-900">
                    <span aria-hidden="true">!</span> Sin verificar
                  </span>
                )}
              </div>

              <p className="mt-1 text-base">{s.profesion}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {etiquetaEntidad(s.entidad_matricula)} · Matrícula {s.numero_matricula}
              </p>

              {s.servicios.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {s.servicios.map((id) => (
                    <li key={id} className="rounded-md bg-muted px-2 py-1 text-sm">
                      {nombreServicio.get(id) ?? id}
                    </li>
                  ))}
                </ul>
              )}

              {s.descripcion && <p className="mt-2 text-base">{s.descripcion}</p>}

              {!s.verificado && (
                <Alert variant="warning" className="mt-3">
                  <AlertDescription className="text-amber-900">
                    Esta persona no ha verificado su matrícula profesional.
                    Verifica su identidad antes de recibir cualquier servicio.
                  </AlertDescription>
                </Alert>
              )}

              {/* Pegado al botón, no en el aviso del final de la lista:
                  cada profesional es una decisión distinta y en un teléfono
                  ese aviso queda a varias pantallas de aquí. */}
              <p className="mt-3 text-sm text-muted-foreground">
                {s.verificado ? AVISO_CONTACTO_VERIFICADO : AVISO_CONTACTO}{' '}
                <Link href="/seguridad" className="underline">
                  Cómo cuidarte
                </Link>
              </p>

              <Button
                className="mt-3 w-full"
                nativeButton={false}
                render={
                  <a
                    href={
                      s.contacto_tipo === 'whatsapp'
                        ? enlaceWhatsapp(s.contacto_publico)
                        : `tel:${s.contacto_publico}`
                    }
                    target={s.contacto_tipo === 'whatsapp' ? '_blank' : undefined}
                    rel={s.contacto_tipo === 'whatsapp' ? 'noopener noreferrer' : undefined}
                  />
                }
              >
                {s.contacto_tipo === 'whatsapp' ? 'Escribir por WhatsApp' : 'Llamar'}
              </Button>

              <div className="mt-2">
                <BotonReportar tipoObjeto="perfil" objetoId={s.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Habla del sello de matrícula, que solo existe en esta pestaña. */}
      {verProfesionales && (
      <Alert className="mt-6">
        <AlertDescription>
          Un sello de matrícula verificada significa únicamente que ese número
          aparece en el registro correspondiente. No verificamos identidad,
          antecedentes ni intenciones.
        </AlertDescription>
      </Alert>
      )}
    </main>
  )
}
