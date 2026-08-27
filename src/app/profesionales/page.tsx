import Link from 'next/link'
import { Plus, Info, Inbox, Briefcase } from 'lucide-react'
import { AccionPrincipal } from '@/components/accion-principal'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { createClient } from '@/lib/supabase/server'
import { ENTIDADES_MATRICULA } from '@/lib/config'
import { enlaceWhatsapp } from '@/lib/contacto'
import { AVISO_CONTACTO, AVISO_CONTACTO_VERIFICADO } from '@/lib/honestidad'
import { BotonReportar } from '@/components/boton-reportar'
import type { EntidadMatricula, AreaServicio } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SelectFiltro } from '@/components/select-filtro'
import { HojaFiltros } from '@/components/hoja-filtros'

export const metadata = { title: 'Profesionales' }

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
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Profesionales">
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
        <ul className="mt-6 space-y-3">
          {servidores.map((s) => (
            <li
              key={s.id}
              id={`p-${s.id}`}
              className="animar-entrada rounded-2xl bg-card p-4 shadow-canto"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-lg font-bold">{s.nombre_visible}</span>
                {s.verificado ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ok/30 bg-ok-suave px-2.5 py-0.5 text-sm font-medium text-foreground">
                    <span aria-hidden="true">✓</span> Matrícula verificada
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-enlace/25 bg-accent px-2.5 py-0.5 text-sm font-medium text-accent-foreground">
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
                    <li key={id} className="rounded-full bg-muted px-3.5 py-1.5 text-sm">
                      {nombreServicio.get(id) ?? id}
                    </li>
                  ))}
                </ul>
              )}

              {s.descripcion && <p className="mt-2 text-base">{s.descripcion}</p>}

              {!s.verificado && (
                <Alert variant="warning" className="mt-3">
                  <AlertDescription>
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
                <Link href="/seguridad" className="text-enlace underline underline-offset-4">
                  Cómo cuidarte
                </Link>
              </p>

              {/* Arena y no lima, aunque sea la acción de la tarjeta: en una
                  lista de veinte fichas ninguna de las veinte es la acción
                  principal de la pantalla (regla 1). */}
              <Button
                variant="secondary"
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
