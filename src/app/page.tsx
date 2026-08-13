import Link from 'next/link'
import {
  PlusCircle,
  HandHeart,
  TimerOff,
  SearchX,
  ShieldCheck,
  MessageSquare,
  PhoneCall,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Categoria } from '@/lib/types'
import { CATEGORIAS, limitePorVencer } from '@/lib/catalogo'
import { TarjetaSolicitud } from '@/components/tarjeta-solicitud'
import { SelectFiltro } from '@/components/select-filtro'
import { Button } from '@/components/ui/button'

const POR_PAGINA = 20

const PASOS = [
  {
    Icono: PlusCircle,
    titulo: 'Publicas qué necesitas',
    texto: 'Eliges municipio, barrio y los artículos de una lista. Nada más.',
  },
  {
    Icono: MessageSquare,
    titulo: 'Alguien responde',
    texto: 'Ves quién puede ayudarte y con qué, junto a su forma de contacto.',
  },
  {
    Icono: PhoneCall,
    titulo: 'Tú decides a quién escribir',
    texto: 'Escribes por WhatsApp o llamas. La plataforma no participa.',
  },
]

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
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Solo municipios con solicitudes abiertas: filtrar por uno vacío no
  // sirve de nada, y mandar los 1.122 del país en cada carga pesaba más
  // que el resto de la página.
  const { data: municipios } = await supabase
    .from('municipios_con_solicitudes')
    .select('*')
    .order('nombre')

  let query = supabase
    .from('solicitudes_publicas')
    .select('*')
    .order('creada_at', { ascending: false })
    .limit(POR_PAGINA)

  if (params.municipio) query = query.eq('municipio', params.municipio)
  if (params.categoria) query = query.eq('categoria', params.categoria as Categoria)
  if (params.antes) query = query.lt('creada_at', params.antes)
  if (params.urgentes) query = query.lt('expira_at', limitePorVencer())

  const { data: solicitudes } = await query

  const hayMas = (solicitudes?.length ?? 0) === POR_PAGINA
  const cursorSiguiente = hayMas ? solicitudes![solicitudes!.length - 1].creada_at : null
  const hayFiltro = !!(params.municipio || params.categoria || params.urgentes)

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <section className="animar-entrada rounded-2xl border border-border bg-secondary p-5 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Pide lo que necesitas. Sin dar tus datos.
        </h1>
        <p className="mt-2 max-w-prose text-base text-muted-foreground">
          Publica qué te hace falta tras el sismo del 10 de agosto. No pedimos
          tu nombre, tu teléfono ni tu dirección: solo el barrio y qué
          necesitas. Todo se borra solo a las 72 horas.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button className="w-full sm:w-auto" nativeButton={false} render={<Link href="/publicar" />}>
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
        <p className="mt-4 flex items-start gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
          El contacto ocurre por fuera de la plataforma. Nunca vemos tu
          teléfono ni tus conversaciones.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Cómo funciona</h2>
        <ol className="lista-escalonada mt-3 grid gap-3 sm:grid-cols-3">
          {PASOS.map(({ Icono, titulo, texto }, i) => (
            <li
              key={titulo}
              className="animar-entrada rounded-xl border border-border bg-card p-4"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icono className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-base font-bold">
                {i + 1}. {titulo}
              </h3>
              <p className="mt-1 text-base text-muted-foreground">{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Solicitudes abiertas</h2>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={construirHref(params, {
              urgentes: params.urgentes ? null : '1',
              antes: null,
            })}
            className={`inline-flex min-h-12 items-center gap-1.5 rounded-full border px-4 text-base transition-colors ${
              params.urgentes
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-muted'
            }`}
          >
            <TimerOff className="size-4" aria-hidden="true" />
            Por vencer
          </Link>
          {hayFiltro && (
            <Link
              href="/"
              className="inline-flex min-h-12 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-base transition-colors hover:bg-muted"
            >
              Quitar filtros
            </Link>
          )}
        </div>

        <form
          method="get"
          className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row"
        >
          {params.urgentes && <input type="hidden" name="urgentes" value="1" />}
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
            name="categoria"
            label="Filtrar por categoría"
            placeholder="Todas las categorías"
            valorInicial={params.categoria ?? ''}
            opciones={CATEGORIAS.map((c) => ({ valor: c.valor, etiqueta: c.etiqueta }))}
          />
          <Button type="submit" className="w-full sm:w-auto">
            Filtrar
          </Button>
        </form>

        {!solicitudes || solicitudes.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
            <SearchX className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-base text-muted-foreground">
              {hayFiltro
                ? 'No hay solicitudes abiertas con estos filtros.'
                : 'Todavía no hay solicitudes abiertas.'}
            </p>
            {hayFiltro && (
              <Button
                variant="outline"
                className="mt-4"
                nativeButton={false}
                render={<Link href="/" />}
              >
                Ver todas
              </Button>
            )}
          </div>
        ) : (
          <ul className="lista-escalonada mt-4 space-y-3">
            {solicitudes.map((s) => (
              <TarjetaSolicitud key={s.codigo} solicitud={s} />
            ))}
          </ul>
        )}

        {hayMas && cursorSiguiente && (
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={construirHref(params, { antes: cursorSiguiente })} />}
            >
              Ver más solicitudes
            </Button>
          </div>
        )}
      </section>
    </main>
  )
}
