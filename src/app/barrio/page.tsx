import Link from 'next/link'
import { Plus } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { AccionPrincipal } from '@/components/accion-principal'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { HojaFiltros, GrupoChips } from '@/components/hoja-filtros'
import { TarjetaProducto } from '@/components/tarjeta-producto'
import { BuscadorDelBarrio } from './buscador'
import { NOMBRE_GRUPO } from '@/contrato/servicios'
import { MODOS_PRECIO } from '@/lib/servicios'

export const metadata = { title: 'Productos' }

/**
 * Pantalla 31. Los productos del vecindario.
 *
 * Cuelga de las fichas de prestador, así que quien aparece aquí ya aceptó que
 * su nombre sea público y se borra con su ficha.
 *
 * El precio es información, no una transacción: AquíVe no vende nada y no
 * cobra comisión (regla de producto 1). Eso se dice en pantalla y no solo en
 * los términos, porque es donde alguien está a punto de acordar un pago.
 */
export default async function BarrioPage({
  searchParams,
}: {
  searchParams: Promise<{
    municipio?: string
    q?: string
    grupo?: string
    modo?: string
  }>
}) {
  const params = await searchParams
  const [productos, mios] = await Promise.all([
    servidor.comunidad.productos({
      municipio: params.municipio,
      busqueda: params.q,
      grupo: params.grupo,
      modo: params.modo as 'gratis' | 'aporte' | 'solidario' | 'normal' | undefined,
    }),
    servidor.comunidad.misProductos(),
  ])

  // Los chips leen de lo que de verdad se aplicó, no de la URL: un
  // ?grupo=inventado no pinta un chip que no está filtrando nada.
  const grupo = params.grupo && NOMBRE_GRUPO[params.grupo] ? params.grupo : null
  const modo = MODOS_PRECIO.some((m) => m.valor === params.modo) ? params.modo! : null

  function sinFiltro(quitar: string) {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries({ q: params.q, grupo, modo })) {
      if (v && k !== quitar) sp.set(k, v)
    }
    const qs = sp.toString()
    return qs ? `/barrio?${qs}` : '/barrio'
  }

  const chipsAplicados = [
    ...(grupo
      ? [{ clave: 'grupo', etiqueta: NOMBRE_GRUPO[grupo], href: sinFiltro('grupo') }]
      : []),
    ...(modo
      ? [
          {
            clave: 'modo',
            etiqueta: MODOS_PRECIO.find((m) => m.valor === modo)!.etiqueta,
            href: sinFiltro('modo'),
          },
        ]
      : []),
  ]

  const hayFiltro = Boolean(params.q || grupo || modo)

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      {/* Se entra desde el inicio, así que la vuelta de reserva es a él.
          Habiendo historia detrás, la flecha va a donde estabas de verdad. */}
      <CabeceraPantalla titulo="Productos" volver="/inicio">
        <HojaFiltros
          action="/barrio"
          id="hoja-filtros-barrio"
          titulo="Filtrar productos"
          aplicados={chipsAplicados}
          chipsExtra={
            mios.length > 0 ? (
              <Link
                href="/barrio/mios"
                className="shadow-canto inline-flex min-h-12 shrink-0 items-center rounded-full bg-card px-4 text-base text-foreground transition-colors hover:bg-muted"
              >
                Mis productos · {mios.length}
              </Link>
            ) : undefined
          }
        >
          {/* La búsqueda escrita viaja como campo oculto: sin esto, filtrar
              por categoría borraba lo que se había buscado. */}
          {params.q && <input type="hidden" name="q" value={params.q} />}
          <GrupoChips
            name="grupo"
            label="Quién lo hace"
            todos="Todas"
            valorInicial={grupo ?? ''}
            opciones={Object.entries(NOMBRE_GRUPO).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            }))}
          />
          <GrupoChips
            name="modo"
            label="Precio"
            todos="Cualquier precio"
            valorInicial={modo ?? ''}
            opciones={MODOS_PRECIO.map((m) => ({ valor: m.valor, etiqueta: m.etiqueta }))}
          />
        </HojaFiltros>
      </CabeceraPantalla>

      <p className="text-base text-muted-foreground">
        Lo que hacen y venden las personas del directorio. Acuerdas el precio y
        la entrega con quien vende: AquíVe no cobra comisión y no recibe el pago.
      </p>

      <BuscadorDelBarrio municipio={params.municipio} busqueda={params.q} />

      {productos.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
          {hayFiltro
            ? 'Nada coincide con lo que buscas.'
            : 'Todavía no hay productos publicados. Si haces algo para vender, puedes ser el primero.'}
        </p>
      ) : (
        <ul className="revelar mt-6 grid gap-3 sm:grid-cols-2">
          {productos.map((p) => (
            <TarjetaProducto key={p.id} producto={p} />
          ))}
        </ul>
      )}

      {/* Pegado a los precios, que es donde nace la duda. */}
      <p className="mt-6 text-sm text-muted-foreground">
        Nadie de AquíVe te va a pedir un adelanto. Acuerda el precio antes y
        paga cuando tengas la cosa en la mano.
      </p>

      <AccionPrincipal etiqueta="Vender algo" Icono={Plus} href="/barrio/publicar" />
    </main>
  )
}
