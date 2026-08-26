'use client'

import { Search } from 'lucide-react'

import { FormularioFiltros } from '@/components/formulario-filtros'

/**
 * El buscador de productos del barrio.
 *
 * Es un componente aparte, y de cliente, por una razón concreta: el botón
 * redondo con la lupa se le pasa a `FormularioFiltros` como función —le
 * hace falta saber si el envío está en curso para deshabilitarlo— y una
 * función no cruza la frontera del servidor al cliente. Escrito dentro de
 * la página, que es Server Component, reventaba con «Functions cannot be
 * passed directly to Client Components».
 *
 * Busca por GET: el resultado tiene URL propia y se puede compartir, igual
 * que los filtros del directorio. El envío no recarga la página —la lista
 * no salta al encabezado— y sin JavaScript el navegador lo manda igual.
 */
export function BuscadorDelBarrio({
  municipio,
  busqueda,
}: {
  municipio?: string
  busqueda?: string
}) {
  return (
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
      {municipio && <input type="hidden" name="municipio" value={municipio} />}
      <label htmlFor="q" className="sr-only">
        Buscar un producto
      </label>
      <input
        id="q"
        name="q"
        defaultValue={busqueda ?? ''}
        placeholder="Buscar un producto"
        className="bg-card border border-input focus-visible:ring-ring min-h-12 flex-1 rounded-full px-5 text-base focus-visible:ring-2 focus-visible:outline-none"
      />
    </FormularioFiltros>
  )
}
