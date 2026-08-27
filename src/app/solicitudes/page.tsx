import Link from 'next/link'
import { Inbox, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import { GRUPOS } from '@/lib/servicios'
import { ListaSolicitudesServicio, type SolicitudDeServicio } from './lista'
import { SelectFiltro } from '@/components/select-filtro'
import { HojaFiltros, GrupoChips } from '@/components/hoja-filtros'
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
  searchParams: Promise<{ municipio?: string; grupo?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const municipio =
    params.municipio && /^[0-9]{5}$/.test(params.municipio) ? params.municipio : null

  // La categoría en vez del oficio (ADR 0011). Se valida contra la lista
  // cerrada antes de pasarla: la base la rechazaría igual, pero un filtro
  // inventado tiene que devolver «todo», no un error.
  const grupo = params.grupo && params.grupo in GRUPOS ? params.grupo : null

  const [{ data: lista }, todos, { data: mio }] = await Promise.all([
    supabase.rpc('solicitudes_de_servicio', {
      p_municipio: municipio,
      p_grupo: grupo,
    }),
    listarMunicipios(supabase),
    supabase.rpc('mi_proveedor', {}),
  ])

  const solicitudes = (lista as unknown as SolicitudDeServicio[]) ?? []
  const nombreMunicipio = mapaDeNombres(todos ?? [])
  const proveedor = (mio as MiProveedor | null) ?? null
  const hayFiltro = !!(municipio || grupo)

  // Solo los municipios que aparecen en el tablero: la lista completa de
  // 1.122 no dice nada aquí.
  const municipiosConSolicitudes = [...new Set(solicitudes.map((s) => s.municipio))]
    .map((c) => ({ codigo: c, nombre: nombreMunicipio.get(c) ?? c }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const chipsAplicados = [
    ...(grupo
      ? [
          {
            clave: 'grupo',
            etiqueta: GRUPOS[grupo as keyof typeof GRUPOS],
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
            href: grupo ? `/solicitudes?grupo=${grupo}` : '/solicitudes',
          },
        ]
      : []),
  ]

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      {/* ⚠ Ya no lleva el segmentado de Servicios ni el chip que volvía al
          directorio. Esto era una vista colgada de /servicios y ahora es un
          destino propio de la barra: los dos lados del directorio, quién
          presta y quién pide, cada uno en su celda. Con el segmentado
          puesto, la pantalla decía pertenecer a un sitio del que ya no
          cuelga. */}
      <CabeceraPantalla titulo="Solicitudes" volver="/inicio">
        <p className="mt-1 text-base text-muted-foreground">
          Qué está pidiendo la gente. Si tienes cómo hacerlo, escríbele.
        </p>

        <HojaFiltros
          action="/solicitudes"
          id="hoja-filtros-pidiendo"
          titulo="Filtrar lo que piden"
          aplicados={chipsAplicados}
        >
          {/* Ocho opciones: chips, no un desplegable con buscador. Una
              lista corta se toca de una vez (regla de interfaz 4). */}
          <GrupoChips
            name="grupo"
            label="Categoría"
            todos="Todas"
            valorInicial={grupo ?? ''}
            opciones={Object.entries(GRUPOS).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
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
            <Link href="/servicios/soy-proveedor" className="text-enlace underline underline-offset-4">
              Publicar mi ficha
            </Link>
          </span>
        </p>
      )}

      {solicitudes.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
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
