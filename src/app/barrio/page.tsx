import Link from 'next/link'
import Image from 'next/image'
import { Search } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { FormularioFiltros } from '@/components/formulario-filtros'
import { precioLegible } from '@/lib/servicios'
import { SOMBRA_CARTEL, type Familia } from '@/lib/familias'
import type { UnidadPrecio } from '@/lib/types'

export const metadata = { title: 'Hecho en el barrio' }

const COLORES: Familia[] = ['verde', 'amarillo', 'azul', 'rojo'] as const

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
  searchParams: Promise<{ municipio?: string; q?: string }>
}) {
  const params = await searchParams
  const productos = await servidor.comunidad.productos({
    municipio: params.municipio,
    busqueda: params.q,
  })

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Hecho en el barrio" />
      <p className="text-base text-muted-foreground">
        Lo que hacen y venden las personas del directorio.
      </p>

      {/* Búsqueda por GET: el resultado tiene URL propia y se puede compartir,
          igual que los filtros del directorio. Va por `FormularioFiltros`
          para que el envío no recargue la página entera y la lista no salte
          al encabezado; sin JavaScript el navegador lo manda igual. */}
      <FormularioFiltros
        action="/barrio"
        className="mt-4 flex gap-2"
        pie={(pendiente) => (
          <button
            type="submit"
            disabled={pendiente}
            className="bg-primary text-primary-foreground shadow-boton active:shadow-boton-hundido flex size-12 shrink-0 items-center justify-center rounded-full transition-all active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-60"
            aria-label="Buscar"
          >
            <Search className="size-5" aria-hidden="true" />
          </button>
        )}
      >
        {params.municipio && (
          <input type="hidden" name="municipio" value={params.municipio} />
        )}
        <label htmlFor="q" className="sr-only">
          Buscar un producto
        </label>
        <input
          id="q"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Buscar un producto"
          className="bg-card border border-input focus-visible:ring-ring min-h-12 flex-1 rounded-full px-5 text-base focus-visible:ring-2 focus-visible:outline-none"
        />
      </FormularioFiltros>

      {productos.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
          {params.q
            ? `Nada coincide con «${params.q}».`
            : 'Todavía no hay productos publicados.'}
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {productos.map((p, i) => (
            <li
              key={p.id}
              className={`overflow-hidden rounded-2xl bg-card ${SOMBRA_CARTEL[COLORES[i % COLORES.length]]}`}
            >
              {p.imagen ? (
                <Image
                  src={p.imagen}
                  alt=""
                  width={600}
                  height={400}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-muted">
                  <span className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
                    Sin foto
                  </span>
                </div>
              )}
              <div className="p-4">
                <h2 className="font-heading text-base leading-tight">{p.nombre}</h2>
                <Link
                  href={`/prestador/${p.proveedor_id}`}
                  className="text-enlace mt-1 block text-base underline-offset-4 hover:underline"
                >
                  {p.proveedor_nombre}
                </Link>
                <p className="mt-2 text-base font-semibold">
                  {precioLegible(p.modo, p.precio_desde, p.unidad as UnidadPrecio | null)}
                </p>
                {p.detalle && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {p.detalle}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Pegado a los precios, que es donde nace la duda. */}
      <p className="mt-6 text-base text-muted-foreground">
        AquíVe no vende nada y no cobra comisión. El precio y la entrega los
        acuerdan ustedes dos, por fuera.
      </p>
    </main>
  )
}
