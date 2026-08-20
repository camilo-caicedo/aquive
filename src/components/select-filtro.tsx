'use client'

import { useState, useSyncExternalStore } from 'react'
import { useContenedorHoja } from '@/components/contenedor-hoja'
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
  // Dentro de una hoja de filtros la lista se monta en la hoja y no en el
  // `body`, o queda debajo de la capa superior del navegador.
  const contenedor = useContenedorHoja()
  const [valor, setValor] = useState(valorInicial)

  // `min-w-0` para que dentro de un `flex-row` los controles encojan y la
  // página no se desborde a lo ancho.
  //
  // ⚠ `flex-1` SOLO desde `sm`. Los bloques de filtros son `flex-col` en
  // el teléfono y `sm:flex-row` en pantalla grande, y en columna el eje
  // principal es el vertical: ahí `flex-1` significa `flex-basis: 0` de
  // ALTO, que gana sobre el `h-12` del control. El resultado era un
  // desplegable de 26 px al lado de uno de 48, y solo en móvil — en el
  // escritorio, con el eje horizontal, los dos se veían bien.
  const envoltura = 'w-full min-w-0 sm:flex-1'

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
          {/* ComboboxValue va como hijo del Trigger, no dentro de `render`:
              si se anida en el Button, Base UI descarta ese contenido y el
              botón queda sin valor visible ni chevron. */}
          <ComboboxTrigger
            aria-label={label}
            className={`bg-background ${envoltura}`}
          >
            <ComboboxValue />
          </ComboboxTrigger>
          <ComboboxContent container={contenedor ?? undefined}>
            <ComboboxInput showTrigger={false} placeholder="Escribe para buscar" />
            <ComboboxEmpty>No encontramos ese lugar.</ComboboxEmpty>
            <ComboboxList>
              {(item: OpcionFiltro) => (
                <ComboboxItem key={item.valor || '__todos'} value={item}>
                  {/* Apilado, no en fila: con el detalle al lado, un nombre
                      largo se parte en tres líneas y no se puede leer. */}
                  <span className="flex min-w-0 flex-col">
                    <span>{item.etiqueta}</span>
                    {item.detalle && (
                      <span className="text-sm text-muted-foreground">{item.detalle}</span>
                    )}
                  </span>
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
        <SelectContent container={contenedor ?? undefined}>
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
