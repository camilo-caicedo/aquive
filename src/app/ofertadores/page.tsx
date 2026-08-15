import Link from 'next/link'
import { Info, Inbox, MapPin, PlusCircle, PackageOpen, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SelectFiltro } from '@/components/select-filtro'
import { BotonReportar } from '@/components/boton-reportar'

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

  const nombreMunicipio = new Map(
    (todosMunicipios ?? []).map((m) => [m.codigo_dane, m.nombre])
  )

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
      <h1 className="font-heading text-3xl">Quién está ofreciendo insumos</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Personas y negocios que ya dijeron con qué pueden ayudar. Mira si
        alguien tiene lo que necesitas y publica tu solicitud: ellos la ven y
        te responden.
      </p>

      <Alert variant="warning" className="mt-4">
        <AlertDescription>
          Desde aquí no se les escribe directamente. Publica lo que necesitas
          —sin dar tus datos— y quien pueda ayudarte te responde con su
          contacto. Así tú decides a quién le escribes.
        </AlertDescription>
      </Alert>

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
            <Button type="submit" className="w-full sm:w-auto">
              Filtrar
            </Button>
          </form>

          <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
            <span>
              La lista solo muestra los {municipios?.length ?? 0} municipios
              donde ya hay alguien ofreciendo.
            </span>
          </p>
        </>
      )}

      {ordenados.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
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
            <Button nativeButton={false} render={<Link href="/publicar" />}>
              Publicar lo que necesito
            </Button>
          </div>
        </div>
      ) : (
        <ul className="lista-escalonada mt-6 space-y-3">
          {ordenados.map((o) => (
            <li
              key={o.id}
              className="animar-entrada rounded-xl border border-border bg-card p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
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
                <p className="mt-3 flex items-center gap-1.5 text-base text-ok">
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

      <div className="mt-8 rounded-xl border border-border bg-secondary p-5">
        <h2 className="font-heading text-2xl">¿Necesitas algo de esto?</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Publica qué te hace falta. No pedimos tu nombre, tu teléfono ni tu
          dirección.
        </p>
        <Button className="mt-4 w-full sm:w-auto" nativeButton={false} render={<Link href="/publicar" />}>
          <PlusCircle className="size-5" aria-hidden="true" />
          Publicar mi solicitud
        </Button>
      </div>
    </main>
  )
}
