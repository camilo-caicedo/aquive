import Link from 'next/link'
import { Info, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ENTIDADES_MATRICULA } from '@/lib/config'
import type { EntidadMatricula, AreaServicio } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SelectFiltro } from '@/components/select-filtro'

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
  searchParams: Promise<{ municipio?: string; servicio?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const [{ data: municipios }, { data: catalogoServicios }] = await Promise.all([
    supabase.from('municipios_con_servidores').select('*').order('nombre'),
    supabase.from('catalogo_servicios').select('*').eq('activo', true).order('orden'),
  ])

  const nombreServicio = new Map((catalogoServicios ?? []).map((s) => [s.id, s.nombre]))

  let query = supabase
    .from('servidores_publicos')
    .select('*')
    // Verificados primero: es la única señal de confianza que damos.
    .order('verificado', { ascending: false })
    .order('nombre_visible')

  if (params.municipio) query = query.contains('municipios', [params.municipio])
  if (params.servicio) query = query.contains('servicios', [params.servicio])

  const { data: servidores } = await query
  const hayFiltro = !!(params.municipio || params.servicio)
  const mostrarFiltros = (municipios?.length ?? 0) > 0 || hayFiltro

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">Profesionales que ofrecen servicios</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Escríbeles directamente. La plataforma no participa en el contacto.
      </p>

      {/* Mismo criterio que el tablero: sin nadie registrado y sin filtros,
          los desplegables solo estorban. */}
      {mostrarFiltros && (
      <>
      <form
        method="get"
        className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row"
      >
        <SelectFiltro
          name="municipio"
          label="Filtrar por municipio"
          placeholder="Todos los municipios"
          valorInicial={params.municipio ?? ''}
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
        <Button type="submit" className="w-full sm:w-auto">
          Filtrar
        </Button>
      </form>

      {/* La lista de municipios está recortada a los que tienen a alguien
          registrado; si no se dice, parece que faltan municipios. */}
      <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
        <Info className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
        <span>
          La lista de municipios solo muestra los {municipios?.length ?? 0} donde
          ya hay profesionales registrados. La de servicios los muestra todos,
          aunque nadie los ofrezca todavía.
        </span>
      </p>
      </>
      )}

      {!servidores || servidores.length === 0 ? (
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

              <Button
                className="mt-3 w-full"
                nativeButton={false}
                render={
                  <a
                    href={
                      s.contacto_tipo === 'whatsapp'
                        ? `https://wa.me/57${s.contacto_publico.replace(/\D/g, '')}`
                        : `tel:${s.contacto_publico}`
                    }
                    target={s.contacto_tipo === 'whatsapp' ? '_blank' : undefined}
                    rel={s.contacto_tipo === 'whatsapp' ? 'noopener noreferrer' : undefined}
                  />
                }
              >
                {s.contacto_tipo === 'whatsapp' ? 'Escribir por WhatsApp' : 'Llamar'}
              </Button>
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
    </main>
  )
}
