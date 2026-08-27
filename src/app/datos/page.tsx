import { BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import { CATEGORIAS } from '@/lib/catalogo'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const metadata = { title: 'Datos abiertos' }

export default async function DatosPage() {
  const supabase = await createClient()

  // `metricas` es el residuo anónimo que sobrevive al borrado: municipio,
  // categoría y tiempos. Sin texto, sin ubicación fina, sin identificadores.
  //
  // El filtro de `es_prueba` no es cosmético: esta tabla no tiene ninguna
  // FK, así que las filas que dejan las solicitudes de prueba al cerrarse
  // o vencer no se pueden identificar de ninguna otra forma. Sin él, cada
  // prueba ensucia para siempre la página de datos abiertos.
  const { data: metricas } = await supabase
    .from('metricas')
    .select('municipio, categoria, cumplida, horas_hasta_respuesta')
    .eq('es_prueba', false)

  // Lo mismo para el módulo de Servicios, ya agregado por la vista.
  const [{ data: servicios }, { data: oficios }] = await Promise.all([
    supabase.from('datos_servicios').select('*'),
    supabase.from('catalogo_oficios').select('id, nombre'),
  ])

  const nombreOficio = new Map((oficios ?? []).map((o) => [o.id, o.nombre]))

  // La vista agrupa por municipio y por oficio; aquí se colapsa a oficio,
  // que es lo que dice algo en una lista: «cuántas veces se buscó una
  // modista» se entiende, «cuántas en el municipio 76001» no.
  const porOficio = Object.values(
    (servicios ?? []).reduce<Record<string, { oficio: string; solicitudes: number; con_respuesta: number }>>(
      (acumulado, fila) => {
        const previo = acumulado[fila.oficio] ?? {
          oficio: fila.oficio,
          solicitudes: 0,
          con_respuesta: 0,
        }
        acumulado[fila.oficio] = {
          oficio: fila.oficio,
          solicitudes: previo.solicitudes + Number(fila.solicitudes),
          con_respuesta: previo.con_respuesta + Number(fila.con_respuesta),
        }
        return acumulado
      },
      {}
    )
  ).sort((a, b) => b.solicitudes - a.solicitudes)

  const municipios = await listarMunicipios(supabase)
  const nombrePorCodigo = new Map((municipios ?? []).map((m) => [m.codigo_dane, m.nombre]))

  const total = metricas?.length ?? 0
  const cumplidas = metricas?.filter((m) => m.cumplida).length ?? 0

  const conRespuesta = (metricas ?? []).filter(
    (m) => typeof m.horas_hasta_respuesta === 'number'
  )
  const medianaHoras = (() => {
    if (conRespuesta.length === 0) return null
    const horas = conRespuesta
      .map((m) => m.horas_hasta_respuesta as number)
      .sort((a, b) => a - b)
    return horas[Math.floor(horas.length / 2)]
  })()

  const porCategoria = CATEGORIAS.map((c) => ({
    ...c,
    total: (metricas ?? []).filter((m) => m.categoria === c.valor).length,
  })).sort((a, b) => b.total - a.total)

  const porMunicipio = [...new Set((metricas ?? []).map((m) => m.municipio))]
    .map((codigo) => ({
      nombre: nombrePorCodigo.get(codigo) ?? codigo,
      total: (metricas ?? []).filter((m) => m.municipio === codigo).length,
    }))
    .sort((a, b) => b.total - a.total)

  const maxCategoria = Math.max(1, ...porCategoria.map((c) => c.total))

  return (
    <main className="animar-pantalla mx-auto max-w-3xl px-4 py-6">
      <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
        Datos abiertos
      </p>
      <h1 className="font-heading mt-2 flex items-center gap-2 text-3xl">
        <BarChart3 className="size-6" aria-hidden="true" />
        Qué se necesitó y dónde
      </h1>
      <p className="mt-2 max-w-prose text-base text-muted-foreground">
        Cuando una solicitud se borra, queda solo este rastro anónimo:
        municipio, categoría, si se resolvió y cuánto tardó. No hay nombres,
        ni direcciones, ni forma de reconstruir quién pidió qué.
      </p>

      {total === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
          Todavía no hay datos. Aparecerán cuando las primeras solicitudes se
          cierren o venzan.
        </p>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-card p-4 shadow-canto">
              <dt className="text-base text-muted-foreground">Solicitudes registradas</dt>
              <dd className="font-heading mt-1 text-4xl">{total}</dd>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-canto">
              <dt className="text-base text-muted-foreground">Se resolvieron</dt>
              <dd className="font-heading mt-1 text-4xl">
                {cumplidas}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  de {total}
                </span>
              </dd>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-canto">
              <dt className="text-base text-muted-foreground">Primera respuesta</dt>
              <dd className="font-heading mt-1 text-4xl">
                {medianaHoras === null ? (
                  <span className="text-base font-normal text-muted-foreground">
                    Sin datos aún
                  </span>
                ) : (
                  <>
                    {medianaHoras < 1 ? '<1' : Math.round(medianaHoras)}
                    <span className="ml-1 text-base font-normal text-muted-foreground">
                      horas (mediana)
                    </span>
                  </>
                )}
              </dd>
            </div>
          </dl>

          <section className="mt-8">
            <h2 className="font-heading text-2xl">Por categoría</h2>
            <ul className="mt-3 space-y-2">
              {porCategoria.map(({ valor, etiqueta, Icono, total: n }) => (
                <li key={valor} className="flex items-center gap-3">
                  <Icono className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="w-28 shrink-0 text-base">{etiqueta}</span>
                  <span
                    className="h-6 rounded-md bg-accent"
                    style={{ width: `${(n / maxCategoria) * 100}%` }}
                    aria-hidden="true"
                  />
                  <span className="text-base font-medium">{n}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="font-heading text-2xl">Por municipio</h2>
            <ul className="mt-3 space-y-1">
              {porMunicipio.map((m) => (
                <li key={m.nombre} className="flex justify-between border-b border-border py-2 text-base">
                  <span>{m.nombre}</span>
                  <span className="font-medium">{m.total}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* El módulo de Servicios deja su propio rastro, y tampoco tiene
          identificadores: la tabla de origen no guarda ni la zona. Va en
          su propia sección porque es otra cosa —trabajo, no insumos— y
          mezclar los dos conteos daría un número que no significa nada. */}
      <section className="mt-10">
        <h2 className="font-heading text-2xl">Servicios que se buscaron</h2>
        <p className="mt-1 max-w-prose text-base text-muted-foreground">
          Lo mismo para el directorio de oficios: cuántas veces se pidió cada
          trabajo, en qué municipio, y si alguien respondió. Sin texto, sin
          barrio y sin nada que permita reconstruir quién pidió qué.
        </p>

        {porOficio.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
            Todavía no hay datos. Aparecerán cuando las primeras solicitudes de
            servicio se cierren o venzan.
          </p>
        ) : (
          <ul className="mt-4 space-y-1">
            {porOficio.map((o) => (
              <li
                key={o.oficio}
                className="flex flex-wrap justify-between gap-2 border-b border-border py-2 text-base"
              >
                <span>{nombreOficio.get(o.oficio) ?? o.oficio}</span>
                <span className="text-muted-foreground">
                  {o.solicitudes}{' '}
                  {o.solicitudes === 1 ? 'solicitud' : 'solicitudes'} ·{' '}
                  {o.con_respuesta} con respuesta
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Alert className="mt-8">
        <AlertDescription>
          Estos datos son públicos a propósito. Son el aporte que sobrevive al
          proyecto cuando deje de operar.
        </AlertDescription>
      </Alert>
    </main>
  )
}
