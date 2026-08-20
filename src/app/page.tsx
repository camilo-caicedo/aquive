import Link from 'next/link'
import { AccionPrincipal } from '@/components/accion-principal'
import { VueltaAlDestino } from '@/app/auth/vuelta'
import {
  Plus,
  PlusCircle,
  HandHeart,
  SearchX,
  ShieldCheck,
  ChevronDown,
  Timer,
  X,
  Info,
  PackageOpen,
  LogIn,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Categoria } from '@/lib/types'
import { CATEGORIAS, limitePorVencer } from '@/lib/catalogo'
import { TarjetaSolicitud } from '@/components/tarjeta-solicitud'
import { SelectFiltro } from '@/components/select-filtro'
import { HojaFiltros, GrupoChips } from '@/components/hoja-filtros'
import { Button } from '@/components/ui/button'
import { AVISO_TABLERO } from '@/lib/honestidad'
import { PlegableRecordado } from '@/components/plegable-recordado'
import { Estado } from '@/components/estado'
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
  return qs ? `/?${qs}` : '/'
}

export default async function InicioPage({
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
      <VueltaAlDestino />
      <section className="animar-entrada rounded-2xl border border-border bg-secondary p-5 sm:p-8">
        {/* El nombre va en el encabezado principal, no solo en la barra de
            arriba. Google rechazó la verificación de la marca dos veces por
            esto: su revisor compara el nombre de la pantalla de
            consentimiento con el de la portada, y «Pide lo que necesitas»
            no contenía ninguno. */}
        <h1 className="font-heading text-3xl leading-tight sm:text-4xl">
          AquíVe: pide lo que necesitas, sin dar tus datos.
        </h1>
        {/* Y qué ES esto, dicho de frente. Lo pide la misma revisión —una
            portada tiene que describir para qué sirve la aplicación— pero
            hace falta igual: alguien que llega por un volante pegado en un
            albergue no tiene de dónde deducirlo. */}
        <p className="mt-3 max-w-prose text-base">
          AquíVe es una plataforma gratuita que conecta, en Colombia, a quien
          necesita algo con quien puede darlo: insumos que alguien entrega sin
          cobrar, servicios de profesionales con matrícula, y el trabajo de
          gente que vive de su oficio.
        </p>
        <p className="mt-2 max-w-prose text-base text-muted-foreground">
          Pedir no exige cuenta. No pedimos tu nombre, tu teléfono ni tu
          dirección: solo el barrio y qué necesitas.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            nativeButton={false}
            render={<Link href="/publicar" />}
          >
            <PlusCircle className="size-5" aria-hidden="true" />
            Necesito ayuda
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            <HandHeart className="size-5" aria-hidden="true" />
            Quiero ayudar
          </Button>
        </div>
        {/* Los tres avisos que antes ocupaban media portada, plegados.
            Abierto de entrada y servido siempre abierto: dentro va lo que
            la revisión de la marca de Google lee para saber para qué es la
            cuenta, así que no puede salir del HTML. Ver
            `PlegableRecordado`. */}
        <PlegableRecordado
          id="portada-avisos"
          className="group mt-4 border-t border-border/70 pt-3"
        >
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-base font-medium [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
            Qué se borra, qué se queda y para qué es la cuenta
          </summary>

          {/* ⚠ Antes la portada decía «todo se borra solo a las 72 horas»,
              y desde que existe el directorio de servicios eso ya no es
              cierto de todo. Si la diferencia no se entiende aquí, la
              existencia del directorio desmiente la promesa de borrado. */}
          <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
            <Timer className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
            Las solicitudes de insumos se borran solas a las 72 horas, con todo
            lo que llevan dentro. El directorio de servicios es lo contrario:
            esas fichas se quedan mientras la persona quiera, y las borra
            cuando quiera.
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
            El contacto ocurre por fuera de la plataforma. Nunca vemos tu
            teléfono ni tus conversaciones.
          </p>
          {/* Quién entra con Google y para qué, dicho en la portada. Lo pide
              la revisión de la marca OAuth —el revisor evalúa el cliente, no
              la aplicación, y sin esto no hay dónde leer para qué sirve ese
              botón—, pero está aquí porque de todos modos es lo que quiere
              saber quien duda antes de tocarlo. Y es cierto: el callback usa
              solo `user.id` y descarta el correo. */}
          <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
            <LogIn className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
            Quien pide ayuda no necesita cuenta. Quien quiere ayudar entra con
            su cuenta de Google para poder responder solicitudes y sostener su
            perfil; de esa cuenta solo guardamos un identificador interno, y el
            correo no se almacena.
          </p>
        </PlegableRecordado>
      </section>

      <section className="mt-8">
        {/* El activo va en papel elevado, no en relleno terracota: la
            terracota es de la acción principal y de nada más (regla 2), y
            aquí competía con «Necesito ayuda» a dos dedos de distancia.

            Los dos modos del tablero. Son enlaces, no pestañas con estado:
            el modo vive en la URL, así que se puede compartir y funciona
            con el JavaScript apagado. */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Cómo mirar el tablero">
          <Link
            href="/"
            aria-current={modoTengo ? undefined : 'page'}
            className={`inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full border px-4 text-base transition-colors sm:flex-initial ${
              modoTengo
                ? 'border-border bg-card hover:bg-muted'
                : 'border-border bg-card font-semibold text-foreground shadow-sm'
            }`}
          >
            Quién necesita ayuda
          </Link>
          <Link
            href="/?modo=tengo"
            aria-current={modoTengo ? 'page' : undefined}
            className={`inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full border px-4 text-base transition-colors sm:flex-initial ${
              modoTengo
                ? 'border-border bg-card font-semibold text-foreground shadow-sm'
                : 'border-border bg-card hover:bg-muted'
            }`}
          >
            <PackageOpen className="size-4 shrink-0" aria-hidden="true" />
            ¿Quién necesita lo que tengo?
          </Link>
        </div>

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
            totalSolicitudes === null
              ? null
              : `${totalSolicitudes} ${
                  totalSolicitudes === 1 ? 'solicitud abierta' : 'solicitudes abiertas'
                }`
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
            <p className="mt-4 text-sm text-muted-foreground">{AVISO_TABLERO}</p>
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
