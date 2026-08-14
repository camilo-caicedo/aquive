'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Categoria, ItemCatalogoPublico } from '@/lib/types'
import { categoria as categoriaInfo, TOPE_SELECCION } from '@/lib/catalogo'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'

/**
 * Elegir qué tengo para dar.
 *
 * Antes esto era navegación por categorías con casillas dentro de un
 * formulario GET, porque el tablero tenía que funcionar sin JavaScript. Ese
 * requisito se quitó en agosto de 2026, y con él se fue la parte más torpe:
 * ya no hay que abrir una categoría, ni arrastrar campos ocultos con lo
 * marcado en las otras, ni perder la selección al enviar.
 *
 * Es el mismo `Combobox` que se usa para el inventario en /registro, así
 * que no entra nada nuevo al bundle. Con 181 ítems, buscar escribiendo es
 * lo único que funciona.
 *
 * La selección sigue viviendo en la URL al consultar: el enlace se puede
 * compartir y los resultados los sigue armando el servidor.
 */
export function SelectorInsumos({
  items,
  seleccionInicial,
  municipio,
}: {
  items: ItemCatalogoPublico[]
  seleccionInicial: string[]
  municipio: string | null
}) {
  const router = useRouter()
  const [seleccion, setSeleccion] = useState<string[]>(seleccionInicial)

  const elegidos = items.filter((i) => seleccion.includes(i.id))
  const lleno = seleccion.length >= TOPE_SELECCION
  const cambiado =
    seleccion.length !== seleccionInicial.length ||
    seleccion.some((id) => !seleccionInicial.includes(id))

  function buscar(ids: string[] = seleccion) {
    const sp = new URLSearchParams()
    sp.set('modo', 'tengo')
    if (municipio) sp.set('municipio', municipio)
    for (const id of ids) sp.append('tengo', id)
    router.push(`/?${sp.toString()}`)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Label className="text-xl font-bold">¿Qué tienes para dar?</Label>
      <p className="mt-1 text-base text-muted-foreground">
        Escribe para buscar y marca lo que puedas entregar. Te mostramos quién
        lo está pidiendo, empezando por quien necesita más cosas de tu lista.
      </p>

      <Combobox
        multiple
        items={items}
        value={elegidos}
        onValueChange={(nuevos: ItemCatalogoPublico[]) =>
          setSeleccion(nuevos.slice(0, TOPE_SELECCION).map((i) => i.id))
        }
        itemToStringLabel={(i: ItemCatalogoPublico) => i.nombre}
        isItemEqualToValue={(a: ItemCatalogoPublico, b: ItemCatalogoPublico) => a.id === b.id}
      >
        <ComboboxChips className="mt-3 min-h-12 py-2">
          {elegidos.map((i) => (
            <ComboboxChip key={i.id} className="h-8 px-2 text-sm">
              {i.nombre}
            </ComboboxChip>
          ))}
          <ComboboxChipsInput
            placeholder={elegidos.length === 0 ? 'Ej: agua, cobijas, arroz' : ''}
            className="min-h-8 text-base"
          />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>No encontramos eso en la lista.</ComboboxEmpty>
          <ComboboxList>
            {(i: ItemCatalogoPublico) => (
              <ComboboxItem key={i.id} value={i}>
                <span className="flex min-w-0 flex-col">
                  <span>{i.nombre}</span>
                  <span className="text-sm text-muted-foreground">
                    {categoriaInfo(i.categoria as Categoria).etiqueta}
                  </span>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {lleno && (
        <p className="mt-2 text-sm text-muted-foreground">
          Llegaste a {TOPE_SELECCION}, que es el máximo. Quita alguno con la
          equis para cambiarlo.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          className="w-full sm:w-auto"
          disabled={seleccion.length === 0}
          onClick={() => buscar()}
        >
          {cambiado || seleccionInicial.length === 0
            ? 'Ver quién lo necesita'
            : 'Actualizar'}
        </Button>
        {seleccion.length > 0 && (
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              setSeleccion([])
              buscar([])
            }}
          >
            Quitar todo
          </Button>
        )}
      </div>
    </div>
  )
}
