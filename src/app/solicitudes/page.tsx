import Link from 'next/link'
import { Inbox, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import { GRUPOS } from '@/lib/servicios'
import { ListaSolicitudesServicio, type SolicitudDeServicio } from './lista'
import { SelectFiltro } from '@/components/select-filtro'
import { HojaFiltros } from '@/components/hoja-filtros'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Button } from '@/components/ui/button'
import type { MiProveedor } from '@/lib/types'

export const metadata = { title: 'Solicitudes de servicio' }

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
              ? `/solicitudes?municipio=${municipio}`
              : '/solicitudes',
          },
        ]
      : []),
    ...(municipio
      ? [
          {
            clave: 'municipio',
            etiqueta: nombreMunicipio.get(municipio) ?? 'Un municipio',
            href: params.oficio
              ? `/solicitudes?oficio=${params.oficio}`
              : '/solicitudes',
          },
        ]
      : []),
  ]

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      {/* ⚠ Ya no lleva el segmentado de Servicios ni el chip que volvía al
          directorio. Esto era una vista colgada de /servicios y ahora es un
          destino propio de la barra: los dos lados del directorio, quién
          presta y quién pide, cada uno en su celda. Con el segmentado
          puesto, la pantalla decía pertenecer a un sitio del que ya no
          cuelga. */}
      <CabeceraPantalla titulo="Solicitudes">
        <p className="mt-1 text-base text-muted-foreground">
          Quién está pidiendo un oficio. Si tienes cómo hacerlo, escríbele.
        </p>

        <HojaFiltros
          action="/solicitudes"
          id="hoja-filtros-pidiendo"
          titulo="Filtrar lo que piden"
          aplicados={chipsAplicados}
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
              render={<Link href="/solicitudes" />}
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
