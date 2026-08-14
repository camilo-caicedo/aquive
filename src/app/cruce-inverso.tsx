import Link from 'next/link'
import { SearchX, Info, PackageOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { COLUMNAS_ITEM_PUBLICO } from '@/lib/types'
import type {
  ItemCatalogoPublico,
  MunicipioQueCalza,
  OfrecimientoResumen,
} from '@/lib/types'
import { TOPE_SELECCION } from '@/lib/catalogo'
import { AVISO_TABLERO } from '@/lib/honestidad'
import { TarjetaSolicitud } from '@/components/tarjeta-solicitud'
import { SelectFiltro } from '@/components/select-filtro'
import { Button } from '@/components/ui/button'
import { SelectorInsumos } from './selector-insumos'

const POR_PAGINA = 20

/**
 * El segundo modo del tablero: "¿quién necesita lo que tengo?".
 *
 * Se marca lo que uno puede dar y salen las solicitudes que lo piden,
 * primero las que coinciden en más cosas. Sin cuenta: ayudar no puede
 * exigir registrarse. Quien sí tiene cuenta con inventario guardado lo
 * carga de un toque, pero es un atajo, no un requisito.
 *
 * La selección vive en la URL para que el enlace se pueda compartir y para
 * que los resultados los arme el servidor; el selector en sí es cliente.
 */
export async function CruceInverso({
  seleccionCruda,
  municipio,
  desde,
}: {
  seleccionCruda: string[]
  municipio: string | null
  desde: number
}) {
  const supabase = await createClient()

  const [{ data: itemsData }, { data: sesion }] = await Promise.all([
    supabase
      .from('catalogo_items')
      .select(COLUMNAS_ITEM_PUBLICO)
      .eq('activo', true)
      .order('orden')
      // El catálogo crece por aprobación de sugerencias, y PostgREST corta
      // en 1000 filas sin avisar: pasado ese punto los ítems del final
      // desaparecerían del selector sin ningún síntoma.
      .limit(2000),
    supabase.auth.getUser(),
  ])

  const items: ItemCatalogoPublico[] = itemsData ?? []
  const idsValidos = new Set(items.map((i) => i.id))

  // La selección viene de la URL, así que se valida contra el catálogo y se
  // recorta antes de tocar la base: nadie decide por query string cuántas
  // filas se leen.
  const seleccion = [...new Set(seleccionCruda)]
    .filter((id) => idsValidos.has(id))
    .slice(0, TOPE_SELECCION)


  function href(cambios: { tengo?: string[]; municipio?: string | null; desde?: number | null } = {}) {
    const sp = new URLSearchParams()
    sp.set('modo', 'tengo')
    const muni = 'municipio' in cambios ? cambios.municipio : municipio
    if (muni) sp.set('municipio', muni)
    for (const id of cambios.tengo ?? seleccion) sp.append('tengo', id)
    const d = 'desde' in cambios ? cambios.desde : null
    if (d) sp.set('desde', String(d))
    return `/?${sp.toString()}`
  }

  // `mis_ofrecimientos` exige sesión y lanza excepción sin ella: sin este
  // guardia, cada visita anónima generaba una consulta de más y una
  // excepción en la base para nada.
  const { data: inventarioData } = sesion?.user
    ? await supabase.rpc('mis_ofrecimientos')
    : { data: null }

  const inventario = (inventarioData as unknown as OfrecimientoResumen[] | null) ?? []
  // Solo lo disponible: quien marcó sus cobijas como entregadas no quiere
  // que el atajo se las vuelva a precargar. Es el mismo criterio que usan
  // los avisos push, y antes las dos pantallas se contradecían.
  const idsInventario = inventario
    .filter((o) => o.disponible)
    .map((o) => o.item_id)
    .filter((id): id is string => id !== null && idsValidos.has(id))
    .slice(0, TOPE_SELECCION)

  const mismoQueInventario =
    idsInventario.length > 0 &&
    idsInventario.length === seleccion.length &&
    idsInventario.every((id) => seleccion.includes(id))

  const [{ data: calzan }, { data: municipiosData }] =
    seleccion.length > 0
      ? await Promise.all([
          supabase.rpc('solicitudes_que_calzan', {
            p_item_ids: seleccion,
            p_municipio: municipio,
            p_limite: POR_PAGINA,
            p_desde: desde,
          }),
          supabase.rpc('municipios_que_calzan', { p_item_ids: seleccion }),
        ])
      : [{ data: null }, { data: null }]

  const resultados = calzan ?? []
  const municipiosCalzan = (municipiosData as unknown as MunicipioQueCalza[] | null) ?? []
  const hayMas = resultados.length === POR_PAGINA

  return (
    <>
      {idsInventario.length > 0 && !mismoQueInventario && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-secondary p-4 sm:flex-row sm:items-center">
          <PackageOpen className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="flex-1 text-base">
            Ya nos contaste que tienes {idsInventario.length}{' '}
            {idsInventario.length === 1 ? 'cosa' : 'cosas'} en tu perfil.
          </p>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            nativeButton={false}
            render={<Link href={href({ tengo: idsInventario })} />}
          >
            Usar lo que tengo guardado
          </Button>
        </div>
      )}

      <SelectorInsumos
        key={seleccion.join(',')}
        items={items}
        seleccionInicial={seleccion}
        municipio={municipio}
      />

      {seleccion.length === 0 ? (
        <p className="mt-4 flex items-start gap-1.5 text-base text-muted-foreground">
          <Info className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
          <span>
            Marca lo que puedas entregar. No necesitas cuenta para esto.
          </span>
        </p>
      ) : (
        <section className="mt-6">
          <h2 className="text-xl font-bold">
            {resultados.length === 0
              ? 'Nadie está pidiendo eso ahora'
              : `Quién necesita lo que tienes (${resultados.length})`}
          </h2>

          {municipiosCalzan.length > 0 && (
            <form
              method="get"
              className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row"
            >
              <input type="hidden" name="modo" value="tengo" />
              {seleccion.map((id) => (
                <input key={id} type="hidden" name="tengo" value={id} />
              ))}
              <SelectFiltro
                name="municipio"
                label="Filtrar por municipio"
                placeholder="Todos los municipios"
                valorInicial={municipio ?? ''}
                conBusqueda
                opciones={municipiosCalzan.map((m) => ({
                  valor: m.codigo_dane,
                  etiqueta: m.nombre,
                  detalle: `${m.total} ${m.total === 1 ? 'solicitud' : 'solicitudes'}`,
                }))}
              />
              <Button type="submit" className="w-full sm:w-auto">
                Filtrar
              </Button>
            </form>
          )}

          {resultados.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
              <SearchX className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-base text-muted-foreground">
                {municipio
                  ? 'Nadie está pidiendo eso en ese municipio ahora mismo.'
                  : 'Nadie está pidiendo eso ahora mismo. Vuelve más tarde o marca otras cosas.'}
              </p>
              {municipio && (
                <Button
                  variant="outline"
                  className="mt-4"
                  nativeButton={false}
                  render={<Link href={href({ municipio: null })} />}
                >
                  Ver en todo el país
                </Button>
              )}
            </div>
          ) : (
            <>
            <p className="mt-4 text-sm text-muted-foreground">{AVISO_TABLERO}</p>
            <ul className="lista-escalonada mt-3 space-y-3">
              {resultados.map((s) => (
                <TarjetaSolicitud
                  key={s.codigo}
                  solicitud={s}
                  coincidencias={s.coincidencias}
                />
              ))}
            </ul>
            </>
          )}

          {hayMas && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={href({ desde: desde + POR_PAGINA })} />}
              >
                Ver más
              </Button>
            </div>
          )}
        </section>
      )}
    </>
  )
}
