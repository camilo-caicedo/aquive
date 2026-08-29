import Link from 'next/link'
import { Plus, Info, Inbox, Briefcase } from 'lucide-react'
import { AccionPrincipal } from '@/components/accion-principal'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { createClient } from '@/lib/supabase/server'
import type { AreaServicio } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SelectFiltro } from '@/components/select-filtro'
import { HojaFiltros } from '@/components/hoja-filtros'
import { FichaProfesional } from './ficha-profesional'

export const metadata = { title: 'Profesionales' }

const AREAS: Record<AreaServicio, string> = {
  ingenieria: 'Ingeniería',
  arquitectura: 'Arquitectura',
  psicologia: 'Psicología',
  salud: 'Salud',
  derecho: 'Derecho',
}

/**
 * El directorio de profesionales con matrícula.
 *
 * Tiene ruta propia y NO comparte pestañas con entidades ni con oficios,
 * aunque las tres listas se parezcan. Cada tira de la portada lleva a su
 * lista y a nada más: llegar buscando un ingeniero y aterrizar en una barra
 * de tres pestañas obliga a leer cuál de las tres estaba activa antes de
 * poder mirar el primer resultado.
 *
 * Antes esto era `/servidores?ver=profesionales`, que sigue funcionando
 * porque redirige aquí.
 */
export default async function ProfesionalesPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string; servicio?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // El municipio entra en una cadena de filtros de PostgREST por
  // interpolación, así que se valida ANTES: un código DANE son cinco
  // dígitos y nada más.
  const municipioCrudo = Array.isArray(params.municipio)
    ? params.municipio[0]
    : params.municipio
  const municipio =
    municipioCrudo && /^[0-9]{5}$/.test(municipioCrudo) ? municipioCrudo : null

  const [{ data: municipios }, { data: catalogoServicios }] = await Promise.all([
    supabase.from('municipios_con_servidores').select('*').order('nombre'),
    supabase.from('catalogo_servicios').select('*').eq('activo', true).order('orden'),
  ])

  const nombreServicio = new Map((catalogoServicios ?? []).map((s) => [s.id, s.nombre]))

  let query = supabase
    .from('servidores_publicos')
    .select('*')
    // Verificados primero: es el único dato comprobado que tenemos, no una recomendación.
    .order('verificado', { ascending: false })
    .order('nombre_visible')

  if (municipio) query = query.contains('municipios', [municipio])
  if (params.servicio) query = query.contains('servicios', [params.servicio])

  const { data: servidores } = await query
  const hayFiltro = !!(municipio || params.servicio)
  const mostrarFiltros = (municipios?.length ?? 0) > 0 || hayFiltro

  // El href de un chip es la URL sin ESE filtro.
  function sinFiltro(quitar: 'municipio' | 'servicio') {
    const sp = new URLSearchParams()
    if (municipio && quitar !== 'municipio') sp.set('municipio', municipio)
    if (params.servicio && quitar !== 'servicio') sp.set('servicio', params.servicio)
    const qs = sp.toString()
    return qs ? `/profesionales?${qs}` : '/profesionales'
  }

  const chipsAplicados = [
    ...(municipio
      ? [
          {
            clave: 'municipio',
            etiqueta:
              (municipios ?? []).find((m) => m.codigo_dane === municipio)?.nombre ??
              'Un municipio',
            href: sinFiltro('municipio'),
          },
        ]
      : []),
    ...(params.servicio
      ? [
          {
            clave: 'servicio',
            etiqueta: nombreServicio.get(params.servicio) ?? 'Un servicio',
            href: sinFiltro('servicio'),
          },
        ]
      : []),
  ]

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Profesionales" volver="/inicio">
        {mostrarFiltros && (
          <HojaFiltros
            action="/profesionales"
            id="hoja-filtros-profesionales"
            titulo="Filtrar profesionales"
            aplicados={chipsAplicados}
          >
            <SelectFiltro
              name="municipio"
              label="Filtrar por municipio"
              placeholder="Todos los municipios"
              valorInicial={municipio ?? ''}
              conBusqueda
              opciones={(municipios ?? []).map((m) => ({
                valor: m.codigo_dane,
                etiqueta: m.nombre,
                detalle: m.departamento,
              }))}
            />
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

            {/* La lista de municipios está recortada a los que tienen a alguien
                registrado; si no se dice, parece que faltan municipios. */}
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <Info className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
              <span>
                La lista de municipios solo muestra los {municipios?.length ?? 0}{' '}
                donde ya hay profesionales registrados. La de servicios los
                muestra todos, aunque nadie los ofrezca todavía.
              </span>
            </p>
          </HojaFiltros>
        )}
      </CabeceraPantalla>

      <p className="text-base text-muted-foreground">
        Personas con matrícula profesional. Cada quien declara la suya; el
        contacto ocurre por fuera y la plataforma no participa.
      </p>

      {!servidores || servidores.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
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
              render={<Link href="/profesionales" />}
            >
              Ver todos
            </Button>
          ) : (
            <Button
              variant="outline"
              className="mt-4"
              nativeButton={false}
              render={<Link href="/registro" />}
            >
              Ofrecer mis servicios
            </Button>
          )}
        </div>
      ) : (
        <ul className="revelar mt-6 space-y-3">
          {servidores.map((s) => (
            <li
              key={s.id}
              id={`p-${s.id}`}
              className="animar-entrada rounded-2xl bg-card p-4 shadow-canto"
            >
              <FichaProfesional
                profesional={{
                  id: s.id,
                  nombre_visible: s.nombre_visible,
                  profesion: s.profesion,
                  verificado: s.verificado,
                  municipios: s.municipios,
                  entidad_matricula: s.entidad_matricula,
                  numero_matricula: s.numero_matricula,
                  descripcion: s.descripcion,
                  contacto_tipo: s.contacto_tipo,
                  contacto_publico: s.contacto_publico,
                  servicios: s.servicios.map((id) => nombreServicio.get(id) ?? id),
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <Alert className="mt-6">
        <AlertDescription>
          Un sello de matrícula verificada significa únicamente que ese número
          aparece en el registro correspondiente. No verificamos identidad,
          antecedentes ni intenciones.
        </AlertDescription>
      </Alert>

      {/* Puente al otro lado del sitio. Lo que importa de este texto es la
          diferencia de vida útil, que es lo que sostiene la promesa de
          borrado del tablero. */}
      <section className="mt-8 flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-canto sm:flex-row sm:items-center sm:p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Briefcase className="size-6" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h2 className="font-heading text-2xl">¿Necesitas contratar a alguien?</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Comida, arreglos de ropa, trasteos, aseo, reparaciones. Gente que
            vive de su trabajo y quiere que la encuentren: a diferencia de las
            solicitudes del tablero, estas fichas no se borran solas. Tú
            acuerdas el precio directamente con la persona.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          nativeButton={false}
          render={<Link href="/directorio" />}
        >
          Ver oficios
        </Button>
      </section>
      <AccionPrincipal
        etiqueta="Necesito un servicio"
        Icono={Plus}
        href="/servicios/publicar"
      />
    </main>
  )
}
