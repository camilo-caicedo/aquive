import Link from 'next/link'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import {
  Info,
  Inbox,
  MapPin,
  Plus,
  PlusCircle,
  PackageOpen,
  Truck,
  ClipboardList,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import { Button } from '@/components/ui/button'
import { SelectFiltro } from '@/components/select-filtro'
import { HojaFiltros } from '@/components/hoja-filtros'
import { BotonReportar } from '@/components/boton-reportar'
import { AccionPrincipal } from '@/components/accion-principal'
import { CintaMiSolicitud } from './cinta-mi-solicitud'

export const metadata = { title: 'Quién está ofreciendo' }

export default async function OfertadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const [{ data: municipios }, todosMunicipios] = await Promise.all([
    supabase.from('municipios_con_ofertadores').select('*').order('nombre'),
    listarMunicipios(supabase),
  ])

  let query = supabase
    .from('ofertadores_publicos')
    .select('*')
    .order('creado_at', { ascending: false })

  if (params.municipio) query = query.contains('municipios', [params.municipio])

  const { data: ofertadores } = await query

  const nombreMunicipio = mapaDeNombres(todosMunicipios ?? [])

  // Quien dijo qué ofrece va primero, y la lista de ítems pesa más que la
  // descripción: una tarjeta que enumera "cobijas, colchonetas" le sirve a
  // quien busca algo concreto mucho más que un párrafo libre.
  const utilidad = (o: { total_items: number; descripcion: string | null }) =>
    (o.total_items > 0 ? 2 : 0) + (o.descripcion ? 1 : 0)
  const ordenados = [...(ofertadores ?? [])].sort((a, b) => utilidad(b) - utilidad(a))

  const hayFiltro = !!params.municipio
  const mostrarFiltros = (municipios?.length ?? 0) > 0 || hayFiltro

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      {/* El titulo era «Ayudas» y lo que decia cual de las tres listas era
          el segmentado. Sin segmentado (regla 3), el h1 tiene que nombrar lo
          que hay en la pantalla: «Quien ofrece». */}
      <CabeceraPantalla titulo="Quién ofrece" />
      <p className="mt-1 text-base text-muted-foreground">
        Personas y negocios que ya dijeron con qué pueden ayudar.
      </p>
      <div className="flex flex-wrap items-center gap-x-5">
        <Link
          href="/ayudas"
          className="inline-flex min-h-12 items-center gap-1.5 text-base text-enlace underline underline-offset-4"
        >
          <ClipboardList className="size-5 shrink-0" aria-hidden="true" />
          Quién necesita ayuda
        </Link>
      </div>
      {/* Antes esta línea decía «desde aquí no se les escribe», y era
          cierta: el contacto solo ocurría cuando alguien respondía una
          solicitud. Con el cruce al revés dejó de serlo — quien ya publicó
          puede llegar al contacto desde su propia solicitud, de a uno.
          Lo que NO cambia es que el teléfono no vive en esta lista: sigue
          detrás del token, y esta pantalla solo enseña el camino. */}
      <p className="mt-2 text-sm text-muted-foreground">
        Si ya publicaste lo que necesitas, te marcamos quién tiene algo tuyo y
        desde ahí puedes escribirle.
      </p>

      <CintaMiSolicitud />


      {mostrarFiltros && (
        <>
          <HojaFiltros
            action="/ofertadores"
            id="hoja-filtros-ofertadores"
            titulo="Filtrar quién ofrece"
            aplicados={
              params.municipio
                ? [
                    {
                      clave: 'municipio',
                      etiqueta: nombreMunicipio.get(params.municipio) ?? 'Un municipio',
                      href: '/ofertadores',
                    },
                  ]
                : []
            }
            conteo={
              <>
                <span className="font-semibold text-foreground">
                  {ordenados.length}{' '}
                  {ordenados.length === 1 ? 'persona o negocio' : 'personas y negocios'}
                </span>
                {params.municipio && (
                  <span className="font-normal">
                    {' '}
                    en {nombreMunicipio.get(params.municipio) ?? 'ese municipio'}
                  </span>
                )}
              </>
            }
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

            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <Info className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
              <span>
                La lista solo muestra los {municipios?.length ?? 0} municipios
                donde ya hay alguien ofreciendo.
              </span>
            </p>
          </HojaFiltros>
        </>
      )}

      {ordenados.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-base text-muted-foreground">
            {hayFiltro
              ? 'Nadie está ofreciendo insumos en ese municipio todavía.'
              : 'Todavía nadie ha publicado qué puede ofrecer.'}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {hayFiltro && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/ofertadores" />}
              >
                Ver todos
              </Button>
            )}
            {/* Sin relleno lima: la píldora fija de abajo ya lleva esa
                misma acción, y dos limas en una pantalla son dos acciones
                principales (regla 1). */}
            <Button variant="outline" nativeButton={false} render={<Link href="/publicar" />}>
              Publicar lo que necesito
            </Button>
          </div>
        </div>
      ) : (
        <ul className="lista-escalonada mt-6 space-y-3">
          {ordenados.map((o) => (
            <li
              key={o.id}
              className="animar-entrada rounded-2xl bg-card p-4 shadow-canto"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <PackageOpen className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold">{o.nombre_visible}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-4 shrink-0" aria-hidden="true" />
                    {o.municipios
                      .map((c) => nombreMunicipio.get(c) ?? c)
                      .join(' · ')}
                  </p>
                </div>
              </div>

              {o.items.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {o.items.map((it) => (
                    <li
                      key={it.nombre}
                      className="rounded-full bg-muted px-3.5 py-1.5 text-sm text-foreground"
                    >
                      {it.nombre}
                      {it.por_confirmar && (
                        <span className="text-muted-foreground"> · por confirmar</span>
                      )}
                    </li>
                  ))}
                  {o.total_items > o.items.length && (
                    <li className="px-2 py-1 text-sm text-muted-foreground">
                      y {o.total_items - o.items.length} más
                    </li>
                  )}
                </ul>
              )}

              {/* Solo cuando es que sí. No marcarlo no afirma que no pueda
                  moverse, y no hay etiqueta para eso. */}
              {o.puede_trasladarse && (
                <p className="mt-3 flex items-center gap-1.5 text-base text-foreground">
                  <Truck className="size-4 shrink-0" aria-hidden="true" />
                  Puede trasladarse a entregar
                </p>
              )}

              {o.descripcion ? (
                <p className="mt-3 text-base">{o.descripcion}</p>
              ) : (
                o.items.length === 0 && (
                  <p className="mt-3 text-base text-muted-foreground">
                    No escribió qué puede ofrecer. Publica tu solicitud y verá
                    si puede ayudarte.
                  </p>
                )
              )}

              <div className="mt-3">
                <BotonReportar tipoObjeto="perfil" objetoId={o.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 rounded-2xl bg-secondary p-5">
        <h2 className="font-heading text-2xl">¿Necesitas algo de esto?</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Publica qué te hace falta. No pedimos tu nombre, tu teléfono ni tu
          dirección.
        </p>
        {/* Lo mismo aquí: el lima de esta pantalla es la píldora fija. */}
        <Button
          variant="outline"
          className="mt-4 w-full sm:w-auto"
          nativeButton={false}
          render={<Link href="/publicar" />}
        >
          <PlusCircle className="size-5" aria-hidden="true" />
          Publicar mi solicitud
        </Button>
      </div>
      <AccionPrincipal etiqueta="Necesito ayuda" Icono={Plus} href="/publicar" />
    </main>
  )
}
