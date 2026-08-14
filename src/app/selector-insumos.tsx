import Link from 'next/link'
import { X } from 'lucide-react'
import type { Categoria, ItemCatalogoPublico } from '@/lib/types'
import { CATEGORIAS } from '@/lib/catalogo'
import { Button } from '@/components/ui/button'

export const TOPE_SELECCION = 12

/**
 * Elegir qué tengo, sin JavaScript y sin 117 casillas en pantalla.
 *
 * Primero las 8 categorías como enlaces; al abrir una, solo sus ítems como
 * casillas dentro de un formulario GET. Lo ya marcado en otras categorías
 * viaja en campos ocultos, así que enviar el formulario suma en vez de
 * reemplazar.
 *
 * Todo son enlaces y un `<form method="get">`: funciona con el JavaScript
 * apagado, que es requisito del tablero. Mismo motivo por el que el
 * desplegable de municipio es un `<select>` nativo.
 */
export function SelectorInsumos({
  items,
  seleccion,
  categoriaAbierta,
  municipio,
  href,
}: {
  items: ItemCatalogoPublico[]
  seleccion: string[]
  categoriaAbierta: Categoria | null
  municipio: string | null
  /** Construye una URL de este mismo modo cambiando lo que se le pase. */
  href: (cambios: { cat?: string | null; tengo?: string[] }) => string
}) {
  const porId = new Map(items.map((i) => [i.id, i]))
  const elegidos = seleccion.map((id) => porId.get(id)).filter((i) => i !== undefined)
  const lleno = seleccion.length >= TOPE_SELECCION

  const itemsDeCategoria = categoriaAbierta
    ? items.filter((i) => i.categoria === categoriaAbierta)
    : []

  // Lo marcado en las OTRAS categorías viaja oculto: sin esto, abrir una
  // categoría y enviar borraría lo elegido en las demás.
  const deOtrasCategorias = elegidos
    .filter((i) => i.categoria !== categoriaAbierta)
    .map((i) => i.id)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-xl font-bold">¿Qué tienes para dar?</h2>
      <p className="mt-1 text-base text-muted-foreground">
        Marca lo que puedas entregar y te mostramos quién lo está pidiendo,
        empezando por quien necesita más cosas de tu lista.
      </p>

      {elegidos.length > 0 && (
        <>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {elegidos.map((i) => (
              <li key={i.id}>
                <Link
                  href={href({ tengo: seleccion.filter((s) => s !== i.id) })}
                  className="inline-flex min-h-12 items-center gap-1 rounded-full border border-primary bg-accent px-3 text-sm text-accent-foreground transition-colors hover:bg-muted"
                >
                  {i.nombre}
                  <X className="size-4 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Quitar {i.nombre}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={href({ tengo: [] })}
            className="mt-2 inline-flex min-h-12 items-center text-base underline"
          >
            Quitar todo
          </Link>
        </>
      )}

      {lleno && (
        <p className="mt-3 text-sm text-muted-foreground">
          Ya marcaste {TOPE_SELECCION} cosas, que es el máximo. Quita alguna
          para cambiarla.
        </p>
      )}

      <div className="mt-4">
        <p className="text-base font-medium">
          {categoriaAbierta ? 'Cambiar de categoría' : 'Elige una categoría'}
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => {
            const abierta = c.valor === categoriaAbierta
            const cuantos = elegidos.filter((i) => i.categoria === c.valor).length
            return (
              <li key={c.valor}>
                <Link
                  href={href({ cat: abierta ? null : c.valor })}
                  className={`inline-flex min-h-12 items-center gap-1.5 rounded-full border px-4 text-base transition-colors ${
                    abierta
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:bg-muted'
                  }`}
                >
                  <c.Icono className="size-4 shrink-0" aria-hidden="true" />
                  {c.etiqueta}
                  {cuantos > 0 && <span aria-hidden="true">· {cuantos}</span>}
                  {cuantos > 0 && (
                    <span className="sr-only">
                      , {cuantos} {cuantos === 1 ? 'marcado' : 'marcados'}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {categoriaAbierta && (
        <form method="get" className="mt-4">
          <input type="hidden" name="modo" value="tengo" />
          <input type="hidden" name="cat" value={categoriaAbierta} />
          {municipio && <input type="hidden" name="municipio" value={municipio} />}
          {deOtrasCategorias.map((id) => (
            <input key={id} type="hidden" name="tengo" value={id} />
          ))}

          <fieldset>
            <legend className="text-base font-medium">
              Marca lo que tengas
            </legend>
            <ul className="mt-2 space-y-1">
              {itemsDeCategoria.map((i) => {
                const marcado = seleccion.includes(i.id)
                return (
                  <li key={i.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-muted has-checked:bg-accent">
                      <input
                        type="checkbox"
                        name="tengo"
                        value={i.id}
                        defaultChecked={marcado}
                        disabled={lleno && !marcado}
                        className="size-6 shrink-0"
                      />
                      <span className="text-base">{i.nombre}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>

          <Button type="submit" className="mt-3 w-full sm:w-auto">
            Ver quién lo necesita
          </Button>
        </form>
      )}
    </div>
  )
}
