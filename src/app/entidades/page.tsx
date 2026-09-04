import Link from 'next/link'
import { Info, Briefcase } from 'lucide-react'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { createClient } from '@/lib/supabase/server'
import { AVISO_ENTIDADES } from '@/lib/honestidad'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import { ListaEntidades } from './lista-entidades'
import { Button } from '@/components/ui/button'
import { SelectFiltro } from '@/components/select-filtro'
import { HojaFiltros } from '@/components/hoja-filtros'

export const metadata = { title: 'Entidades' }

/**
 * El directorio de organizaciones, con ruta propia y sin pestañas.
 *
 * Está separado de `/profesionales` a propósito, y no solo por comodidad de
 * navegación: una entidad no se contrata. No cobra, no recibe pedidos por
 * aquí y la plataforma únicamente dice que existe y enlaza a su sitio. En la
 * misma lista que los profesionales, la entidad se lee como un prestador más
 * y alguien intenta contratarla.
 *
 * Antes esto era `/servidores` a secas, que sigue funcionando porque
 * redirige aquí.
 */
export default async function EntidadesPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Cinco dígitos y nada más: este valor se interpola en una cadena de
  // filtros de PostgREST más abajo.
  const municipioCrudo = Array.isArray(params.municipio)
    ? params.municipio[0]
    : params.municipio
  const municipio =
    municipioCrudo && /^[0-9]{5}$/.test(municipioCrudo) ? municipioCrudo : null

  // El filtro por municipio devuelve las entidades locales de ese municipio
  // Y TODAS las nacionales: una entidad nacional también atiende ahí. Es lo
  // que más fácil se implementa mal.
  const consulta = supabase
    .from('entidades_publicas')
    .select('*')
    .order('orden')
    .order('nombre')

  const [{ data: entidades }, { data: municipiosConEntidades }, todosLosMunicipios] =
    await Promise.all([
      municipio
        ? consulta.or(`cobertura.eq.nacional,municipios.cs.{${municipio}}`)
        : consulta,
      supabase.from('municipios_con_entidades').select('*').order('nombre'),
      listarMunicipios(supabase),
    ])

  const nombreMunicipio = mapaDeNombres(todosLosMunicipios ?? [])
  const mostrarFiltros = (municipiosConEntidades?.length ?? 0) > 0 || !!municipio

  const chipsAplicados = municipio
    ? [
        {
          clave: 'municipio',
          etiqueta:
            (municipiosConEntidades ?? []).find((m) => m.codigo_dane === municipio)
              ?.nombre ??
            nombreMunicipio.get(municipio) ??
            'Un municipio',
          href: '/entidades',
        },
      ]
    : []

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Entidades" volver="/inicio">
        {mostrarFiltros && (
          <HojaFiltros
            action="/entidades"
            id="hoja-filtros-entidades"
            titulo="Filtrar entidades"
            aplicados={chipsAplicados}
          >
            <SelectFiltro
              name="municipio"
              label="Filtrar por municipio"
              placeholder="Todos los municipios"
              valorInicial={municipio ?? ''}
              conBusqueda
              opciones={(municipiosConEntidades ?? []).map((m) => ({
                valor: m.codigo_dane,
                etiqueta: m.nombre,
                detalle: m.departamento,
              }))}
            />

            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <Info className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
              <span>
                La lista solo muestra los {municipiosConEntidades?.length ?? 0}{' '}
                municipios con entidades locales. Las de cobertura nacional
                salen siempre, filtres por donde filtres.
              </span>
            </p>
          </HojaFiltros>
        )}
      </CabeceraPantalla>

      <p className="text-base text-muted-foreground">
        Organizaciones que trabajan en la zona. No reciben pedidos por AquíVe:
        aquí solo decimos que existen y a dónde escribirles.
      </p>

      <p className="mt-4 text-sm text-muted-foreground">{AVISO_ENTIDADES}</p>
      <ListaEntidades entidades={entidades ?? []} nombreMunicipio={nombreMunicipio} />

      {/* Puente al otro lado del sitio: quien llegó buscando ayuda de una
          organización muchas veces lo que necesita es contratar a alguien. */}
      <section className="mt-8 flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-canto sm:flex-row sm:items-center sm:p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Briefcase className="size-6" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h2 className="font-heading text-2xl">¿Necesitas contratar a alguien?</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Comida, arreglos de ropa, trasteos, aseo, reparaciones. Gente que
            vive de su trabajo y quiere que la encuentren. Tú acuerdas el
            precio directamente con la persona.
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
    </main>
  )
}
