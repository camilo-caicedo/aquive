'use client'

import { useState, useSyncExternalStore } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export interface OpcionFiltro {
  valor: string
  etiqueta: string
  /** Texto secundario, p. ej. el departamento del municipio. */
  detalle?: string
}

const sinSuscripcion = () => () => {}
const enCliente = () => true
const enServidor = () => false

/**
 * Select de filtro que se degrada de verdad.
 *
 * En el HTML servido (y por tanto sin JavaScript) sale un `<select>`
 * nativo, que es lo único que funciona dentro de un `<form method="get">`
 * sin JS — requisito duro del tablero público. Ya hidratado se cambia por
 * un Combobox con buscador cuando la lista es larga (1.100+ municipios no
 * se pueden recorrer a dedo), o por un Select simple cuando es corta.
 */
export function SelectFiltro({
  name,
  label,
  placeholder,
  opciones,
  valorInicial,
  conBusqueda = false,
}: {
  name: string
  label: string
  placeholder: string
  opciones: OpcionFiltro[]
  valorInicial: string
  conBusqueda?: boolean
}) {
  const hidratado = useSyncExternalStore(sinSuscripcion, enCliente, enServidor)
  const [valor, setValor] = useState(valorInicial)

  // min-w-0 + flex-1: sin esto, dentro de un `flex-row` los controles no
  // encogen y la página se desborda a lo ancho.
  const envoltura = 'min-w-0 flex-1'

  if (!hidratado) {
    return (
      <select
        name={name}
        defaultValue={valorInicial}
        aria-label={label}
        className={`h-12 w-full rounded-lg border border-input bg-background px-3 text-base ${envoltura}`}
      >
        <option value="">{placeholder}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
            {o.detalle ? ` — ${o.detalle}` : ''}
          </option>
        ))}
      </select>
    )
  }

  const seleccionada = opciones.find((o) => o.valor === valor)

  if (conBusqueda) {
    const items: OpcionFiltro[] = [{ valor: '', etiqueta: placeholder }, ...opciones]
    return (
      <>
        <input type="hidden" name={name} value={valor} />
        <Combobox
          items={items}
          value={seleccionada ?? items[0]}
          onValueChange={(o: OpcionFiltro | null) => setValor(o?.valor ?? '')}
          itemToStringLabel={(o: OpcionFiltro) => o.etiqueta}
          isItemEqualToValue={(a: OpcionFiltro, b: OpcionFiltro) => a.valor === b.valor}
        >
          <ComboboxTrigger
            aria-label={label}
            render={
              <Button
                variant="outline"
                className={`justify-between bg-background font-normal ${envoltura}`}
              >
                <ComboboxValue />
              </Button>
            }
          />
          <ComboboxContent>
            <ComboboxInput showTrigger={false} placeholder="Escribe para buscar" />
            <ComboboxEmpty>No encontramos ese lugar.</ComboboxEmpty>
            <ComboboxList>
              {(item: OpcionFiltro) => (
                <ComboboxItem key={item.valor || '__todos'} value={item}>
                  <span>{item.etiqueta}</span>
                  {item.detalle && (
                    <span className="text-sm text-muted-foreground">{item.detalle}</span>
                  )}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </>
    )
  }

  return (
    <>
      <input type="hidden" name={name} value={valor} />
      <Select value={valor} onValueChange={(v) => setValor(v ?? '')}>
        <SelectTrigger aria-label={label} className={`bg-background ${envoltura}`}>
          <SelectValue placeholder={placeholder}>
            {(v: string) => opciones.find((o) => o.valor === v)?.etiqueta ?? placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{placeholder}</SelectItem>
          {opciones.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
