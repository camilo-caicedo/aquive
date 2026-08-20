import Link from 'next/link'
import { AccionPrincipal } from '@/components/accion-principal'
import {
  Plus,
  PlusCircle,
  SearchX,
  ShieldAlert,
  X,
  Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Categoria } from '@/lib/types'
import { CATEGORIAS, limitePorVencer } from '@/lib/catalogo'
import { TarjetaSolicitud } from '@/components/tarjeta-solicitud'
import { SelectFiltro } from '@/components/select-filtro'
import { HojaFiltros, GrupoChips } from '@/components/hoja-filtros'
import { Button } from '@/components/ui/button'
import { AVISO_TABLERO_CORTO } from '@/lib/honestidad'
import { Estado } from '@/components/estado'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { PestanasAyudas } from '@/components/pestanas-ayudas'
import { CruceInverso } from './cruce-inverso'

const POR_PAGINA = 20

function construirHref(
  actuales: { municipio?: string; categoria?: string; urgentes?: string },
  cambios: Record<string, string | null>
) {
  const sp = new URLSearchParams()
  if (actuales.municipio) sp.set('municipio', actuales.municipio)
  if (actuales.categoria) sp.set('categoria', actuales.categoria)
  if (actuales.urgentes) sp.set('urgentes', actuales.urgentes)
  for (const [k, v] of Object.entries(cambios)) {
    if (v === null) sp.delete(k)
    else sp.set(k, v)
  }
  const qs = sp.toString()
  return qs ? `/ayudas?${qs}` : '/ayudas'
}

export const metadata = { title: 'Ayudas' }

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{
    municipio?: string
    categoria?: string
    antes?: string
    urgentes?: string
    modo?: string
    // Repetido en la URL: `?tengo=agua&tengo=arroz`. Vive ahí y no solo en
    // el estado del selector para que el enlace se pueda compartir y para
    // que los resultados los arme el servidor.
    tengo?: string | string[]
    desde?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const modoTengo = params.modo === 'tengo'
  const seleccionCruda =
    params.tengo === undefined ? [] : Array.isArray(params.tengo) ? params.tengo : [params.tengo]

  // Acotado aquí y no solo en la base: `?desde=1e10` pasa el `> 0`, el cast
  // a integer de Postgres revienta, y la pantalla acaba diciendo "nadie está
  // pidiendo eso" cuando en realidad la consulta falló. Un error no puede
  // disfrazarse de respuesta legítima.
  const desdeCrudo = Number.parseInt(params.desde ?? '', 10)
  const desdeSeguro =
    Number.isFinite(desdeCrudo) && desdeCrudo > 0 ? Math.min(desdeCrudo, 10000) : 0

  // Solo municipios con solicitudes abiertas: filtrar por uno vacío no
  // sirve de nada, y mandar los 1.122 del país en cada carga pesaba más
  // que el resto de la página. En el segundo modo no se consulta nada de
  // esto: los datos los trae `CruceInverso` con su propio criterio.
  const { data: municipios } = modoTengo
    ? { data: null }
    : await supabase.from('municipios_con_solicitudes').select('*').order('nombre')

  let query = supabase
    .from('solicitudes_publicas')
    .select('*')
    .order('creada_at', { ascending: false })
    .limit(POR_PAGINA)

  if (params.municipio) query = query.eq('municipio', params.municipio)
  if (params.categoria) query = query.eq('categoria', params.categoria as Categoria)
  if (params.antes) query = query.lt('creada_at', params.antes)
  if (params.urgentes) query = query.lt('expira_at', limitePorVencer())

  // El conteo que va al lado de los chips. Es una consulta aparte porque la
  // lista viene paginada con cursor: contar sobre `query` diría cuántas
  // quedan de esta página hacia atrás, no cuántas hay con estos filtros.
  // `head: true` no trae ni una fila, solo el número.
  let conteo = supabase
    .from('solicitudes_publicas')
    .select('*', { count: 'exact', head: true })
  if (params.municipio) conteo = conteo.eq('municipio', params.municipio)
  if (params.categoria) conteo = conteo.eq('categoria', params.categoria as Categoria)
  if (params.urgentes) conteo = conteo.lt('expira_at', limitePorVencer())

  const [{ data: solicitudes }, { count: totalSolicitudes }] = modoTengo
    ? [{ data: null }, { count: null }]
    : await Promise.all([query, conteo])

  const hayMas = (solicitudes?.length ?? 0) === POR_PAGINA
  const cursorSiguiente = hayMas ? solicitudes![solicitudes!.length - 1].creada_at : null
  const hayFiltro = !!(params.municipio || params.categoria || params.urgentes)
  const mostrarFiltros = (municipios?.length ?? 0) > 0 || hayFiltro

  const nombreDeMunicipio = new Map(
    (municipios ?? []).map((m) => [m.codigo_dane, m.nombre] as const)
  )

  const chipsAplicados = [
    ...(params.municipio
      ? [
          {
            clave: 'municipio',
            etiqueta: nombreDeMunicipio.get(params.municipio) ?? 'Un municipio',
            href: construirHref(params, { municipio: null, antes: null }),
          },
        ]
      : []),
    ...(params.categoria
      ? [
          {
            clave: 'categoria',
            etiqueta:
              CATEGORIAS.find((c) => c.valor === params.categoria)?.etiqueta ??
              'Una categoría',
            href: construirHref(params, { categoria: null, antes: null }),
          },
        ]
      : []),
    ...(params.urgentes
      ? [
          {
            clave: 'urgentes',
            etiqueta: 'Por vencer',
            href: construirHref(params, { urgentes: null, antes: null }),
          },
        ]
      : []),
  ]

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <CabeceraPantalla titulo="Ayudas">
        <p className="mt-1 text-base text-muted-foreground">
          Insumos para la emergencia: quién los necesita y quién los tiene.
          Pedir no exige cuenta.
        </p>
        <PestanasAyudas activa={modoTengo ? 'tengo' : 'necesitan'} />
      </CabeceraPantalla>

      <section>

        {modoTengo ? (
          <div className="mt-4">
            <CruceInverso
              seleccionCruda={seleccionCruda}
              municipio={params.municipio ?? null}
              desde={desdeSeguro}
            />
          </div>
        ) : (
        <>
        <h2 className="font-heading mt-4 text-2xl">Solicitudes abiertas</h2>

        {/* Con el tablero vacío y sin filtros, mostrar filtros sería pedirle
            a la gente que filtre la nada: tres avisos diciendo lo mismo. */}
        {mostrarFiltros && (
        <>
        <HojaFiltros
          action="/"
          id="hoja-filtros-tablero"
          titulo="Filtrar solicitudes"
          aplicados={chipsAplicados}
          conteo={
            totalSolicitudes === null ? null : (
              <>
                <span className="font-semibold text-foreground">
                  {totalSolicitudes}{' '}
                  {totalSolicitudes === 1 ? 'solicitud abierta' : 'solicitudes abiertas'}
                </span>
                {params.municipio && (
                  <span> en {nombreDeMunicipio.get(params.municipio) ?? 'ese municipio'}</span>
                )}
              </>
            )
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

          {/* Sin esto, quien no encuentra su municipio en la lista concluye
              que la plataforma no lo cubre. La lista está recortada a los
              que tienen algo publicado, y eso hay que decirlo. */}
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
            <span>
              La lista solo muestra los {municipios?.length ?? 0}{' '}
              {municipios?.length === 1 ? 'municipio que tiene' : 'municipios que tienen'}{' '}
              solicitudes abiertas ahora. Puedes publicar desde cualquier
              municipio del país.
            </span>
          </p>

          <GrupoChips
            name="categoria"
            label="Categoría"
            todos="Todas"
            valorInicial={params.categoria ?? ''}
            opciones={CATEGORIAS.map((c) => ({ valor: c.valor, etiqueta: c.etiqueta }))}
          />

          {/* «Por vencer» era un enlace suelto encima del formulario, en
              relleno terracota, compitiendo con la acción principal. Ahora
              es un criterio más, y se aplica con el mismo botón. */}
          <GrupoChips
            name="urgentes"
            label="Cuánto les queda"
            todos="Todas"
            valorInicial={params.urgentes ?? ''}
            opciones={[{ valor: '1', etiqueta: 'Por vencer' }]}
          />
        </HojaFiltros>
        </>
        )}

        {!solicitudes || solicitudes.length === 0 ? (
          <div className="mt-6">
            <Estado
              Icono={SearchX}
              titulo={
                hayFiltro
                  ? 'No hay solicitudes con estos filtros'
                  : 'Todavía no hay solicitudes abiertas'
              }
              detalle={
                hayFiltro
                  ? 'Quita uno y vuelve a mirar.'
                  : 'En ningún municipio del país. Puedes publicar la primera.'
              }
              accion={
                hayFiltro ? (
                  // Enseña QUÉ chip quitar, no un «ver todas» genérico:
                  // con tres filtros puestos, lo que hace falta saber es
                  // cuál sobra.
                  <>
                    {chipsAplicados.map((c) => (
                      <Link
                        key={c.clave}
                        href={c.href}
                        scroll={false}
                        className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-card px-4 text-base transition-colors hover:bg-muted"
                      >
                        Quitar {c.etiqueta}
                        <X className="size-4 shrink-0" aria-hidden="true" />
                      </Link>
                    ))}
                  </>
                ) : (
                  <Button nativeButton={false} render={<Link href="/publicar" />}>
                    <PlusCircle className="size-5" aria-hidden="true" />
                    Publicar la primera
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <>
            {/* Regla 5: arriba una línea corta con su enlace, no el
                párrafo entero. Antes esto era texto suelto que decía que no
                verificamos a nadie y ahí se acababa — cierto, y sin ninguna
                salida: quien lo leía y se preocupaba no tenía a dónde ir.
                El texto íntegro sigue pegado a la decisión, en cada
                respuesta. */}
            <p className="mt-4 flex items-start gap-1.5 text-sm text-muted-foreground">
              <ShieldAlert className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
              <span>
                {AVISO_TABLERO_CORTO}{' '}
                <Link href="/seguridad" className="underline underline-offset-4">
                  Cómo cuidarte
                </Link>
              </span>
            </p>
            <ul className="lista-escalonada mt-3 space-y-3">
              {solicitudes.map((s) => (
                <TarjetaSolicitud key={s.codigo} solicitud={s} />
              ))}
            </ul>
          </>
        )}

        {hayMas && cursorSiguiente && (
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={construirHref(params, { antes: cursorSiguiente })} scroll={false} />}
            >
              Ver más solicitudes
            </Button>
          </div>
        )}
        </>
        )}
      </section>
      {/* La acción principal de la portada. Los dos botones del héroe
          bajan a arena para que la única terracota rellena de la pantalla
          sea ésta (regla 2): el héroe se va con el desplazamiento y la
          píldora se queda donde llega el pulgar. */}
      {!modoTengo && (
        <AccionPrincipal etiqueta="Necesito ayuda" Icono={Plus} href="/publicar" />
      )}
    </main>
  )
}
