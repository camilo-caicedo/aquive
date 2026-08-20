import Link from 'next/link'
import { Inbox, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import { GRUPOS } from '@/lib/servicios'
import { ListaSolicitudesServicio, type SolicitudDeServicio } from './lista'
import { PestanasServicios } from '@/components/pestanas-servicios'
import { SelectFiltro } from '@/components/select-filtro'
import { HojaFiltros } from '@/components/hoja-filtros'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Button } from '@/components/ui/button'
import type { MiProveedor } from '@/lib/types'

export const metadata = { title: 'Quién necesita un servicio' }

/**
 * El otro lado del directorio: lo que la gente está pidiendo.
 *
 * Es público —cualquiera puede mirarlo, y no hay nada que identifique a
 * quien pidió— pero responder exige tener ficha publicada. La RPC lo
 * vuelve a comprobar; aquí solo se decide qué botón se dibuja.
 */
export default async function SolicitudesDeServicioPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string; oficio?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const municipio =
    params.municipio && /^[0-9]{5}$/.test(params.municipio) ? params.municipio : null

  const [{ data: lista }, { data: oficios }, todos, { data: mio }] = await Promise.all([
    supabase.rpc('solicitudes_de_servicio', {
      p_municipio: municipio,
      p_oficio_id: params.oficio ?? null,
    }),
    supabase.from('catalogo_oficios').select('*').eq('activo', true).order('orden'),
    listarMunicipios(supabase),
    supabase.rpc('mi_proveedor', {}),
  ])

  const solicitudes = (lista as unknown as SolicitudDeServicio[]) ?? []
  const nombreMunicipio = mapaDeNombres(todos ?? [])
  const proveedor = (mio as MiProveedor | null) ?? null
  const hayFiltro = !!(municipio || params.oficio)

  // Solo los municipios que aparecen en el tablero: la lista completa de
  // 1.122 no dice nada aquí.
  const municipiosConSolicitudes = [...new Set(solicitudes.map((s) => s.municipio))]
    .map((c) => ({ codigo: c, nombre: nombreMunicipio.get(c) ?? c }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const chipsAplicados = [
    ...(params.oficio
      ? [
          {
            clave: 'oficio',
            etiqueta: (oficios ?? []).find((o) => o.id === params.oficio)?.nombre ?? 'Un oficio',
            href: municipio
              ? `/servicios/solicitudes?municipio=${municipio}`
              : '/servicios/solicitudes',
          },
        ]
      : []),
    ...(municipio
      ? [
          {
            clave: 'municipio',
            etiqueta: nombreMunicipio.get(municipio) ?? 'Un municipio',
            href: params.oficio
              ? `/servicios/solicitudes?oficio=${params.oficio}`
              : '/servicios/solicitudes',
          },
        ]
      : []),
  ]

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      {/* Es una vista más de Servicios, no una pantalla aparte: el mismo
          título, el mismo segmentado, y un chip que dice cuál de las dos
          listas se está mirando. Antes tenía título propio, dos botones y
          el formulario de filtros desplegado, así que parecía otro sitio. */}
      {/* Con vuelta al directorio: se entra aquí desde ahí, y el
          segmentado de arriba solo cambia de lista, no de vista. */}
      <CabeceraPantalla titulo="Servicios" volver="/servicios">
        <PestanasServicios activa="oficios" />

        <HojaFiltros
          action="/servicios/solicitudes"
          id="hoja-filtros-pidiendo"
          titulo="Filtrar lo que piden"
          aplicados={chipsAplicados}
          chipsExtra={
          // Interruptor, no una pestaña más: encendido lleva de vuelta al
          // directorio. Sin esto, entrar aquí era un callejón —el segmentado
          // de arriba solo cambia de lista, no de vista— y no quedaba forma
          // de volver a ver proveedores.
            <Link
              href="/servicios"
              aria-pressed="true"
              className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-primary bg-accent px-4 text-base font-medium text-accent-foreground"
            >
              <Inbox className="size-4" aria-hidden="true" />
              Quién está pidiendo
            </Link>
          }
        >
          <SelectFiltro
            name="oficio"
            label="Filtrar por oficio"
            placeholder="Todos los oficios"
            valorInicial={params.oficio ?? ''}
            conBusqueda
            opciones={(oficios ?? []).map((o) => ({
              valor: o.id,
              etiqueta: o.nombre,
              detalle: GRUPOS[o.grupo],
            }))}
          />
          <SelectFiltro
            name="municipio"
            label="Filtrar por municipio"
            placeholder="Todos los municipios"
            valorInicial={municipio ?? ''}
            conBusqueda
            opciones={municipiosConSolicitudes.map((m) => ({
              valor: m.codigo,
              etiqueta: m.nombre,
            }))}
          />
        </HojaFiltros>
      </CabeceraPantalla>

      {/* Lo que hay que saber antes de responder, en una línea: el teléfono
          no se ve hasta que respondes, y después decide quien pidió. */}
      <p className="flex items-start gap-1.5 text-base text-muted-foreground">
        <Info className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
        <span>
          Quien pide no ve tu teléfono hasta que respondes. Después decide si te
          escribe.
        </span>
      </p>

      <p className="mt-3 text-base text-muted-foreground">
        <span className="font-semibold text-foreground">
          {solicitudes.length}{' '}
          {solicitudes.length === 1 ? 'persona busca' : 'personas buscan'}
        </span>{' '}
        algo que tú haces
      </p>

      {!proveedor && (
        <p className="mt-4 flex items-start gap-1.5 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
          <span>
            Para responder necesitas tener tu ficha publicada en el directorio.{' '}
            <Link href="/servicios/soy-proveedor" className="underline">
              Publicar mi ficha
            </Link>
          </span>
        </p>
      )}

      {solicitudes.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-base text-muted-foreground">
            {hayFiltro
              ? 'No hay solicitudes con estos filtros.'
              : 'Nadie ha pedido nada todavía.'}
          </p>
          {hayFiltro && (
            <Button
              variant="outline"
              className="mt-4"
              nativeButton={false}
              render={<Link href="/servicios/solicitudes" />}
            >
              Ver todas
            </Button>
          )}
        </div>
      ) : (
        <ListaSolicitudesServicio
          solicitudes={solicitudes}
          nombreMunicipio={Object.fromEntries((todos ?? []).map((m) => [m.codigo_dane, m.nombre]))}
          puedeResponder={!!proveedor}
        />
      )}
    </main>
  )
}
