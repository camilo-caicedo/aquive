'use client'

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormularioFiltros } from '@/components/formulario-filtros'
import { ContenedorHoja } from '@/components/contenedor-hoja'
import type { OpcionFiltro } from '@/components/select-filtro'

const sinSuscripcion = () => () => {}
const enCliente = () => true
const enServidor = () => false

export interface ChipAplicado {
  /** El parámetro que quita, solo para la `key`. */
  clave: string
  /** Lo que se lee en el chip: «Buenaventura», «Agua y aseo». */
  etiqueta: string
  /** La URL actual sin ese filtro. La calcula la página. */
  href: string
}

/**
 * Un criterio corto como chips seleccionables, dentro del mismo
 * `<form method="get">`.
 *
 * Son `<input type="radio">` de verdad, con `defaultChecked`: viajan en el
 * `FormData` como lo hacía el `<select>`, funcionan sin JavaScript y no
 * navegan al tocarlos —marcan, y aplica el botón del pie—. El estilo sale
 * de `peer-checked`, así que tampoco hay estado de React que mantener.
 *
 * Para las listas largas —municipio, oficio, servicio— esto no sirve:
 * 1.122 municipios no se recorren a dedo. Ésas siguen con `SelectFiltro` y
 * su buscador.
 */
export function GrupoChips({
  name,
  label,
  opciones,
  valorInicial,
  todos,
  nota,
}: {
  name: string
  /** El título del grupo: «Categoría», «Precio». */
  label: string
  opciones: OpcionFiltro[]
  valorInicial: string
  /** La opción vacía: «Todas las categorías». */
  todos: string
  nota?: ReactNode
}) {
  const todas: OpcionFiltro[] = [{ valor: '', etiqueta: todos }, ...opciones]

  return (
    <fieldset>
      <legend className="text-base font-medium">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {todas.map((o) => (
          <label key={o.valor || '__todos'} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.valor}
              defaultChecked={o.valor === valorInicial}
              className="peer sr-only"
            />
            {/* Arena con borde, no relleno terracota: la terracota es de la
                acción principal y de nada más (regla 2). Lo marcado se
                distingue por borde, fondo Y peso de letra, para que no
                dependa solo del color (regla 9). */}
            <span className="inline-flex min-h-12 items-center rounded-full border border-border bg-card px-4 text-base transition-colors peer-checked:border-primary peer-checked:bg-secondary peer-checked:font-semibold peer-checked:text-secondary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
              {o.etiqueta}
            </span>
          </label>
        ))}
      </div>
      {nota && <p className="mt-2 text-sm text-muted-foreground">{nota}</p>}
    </fieldset>
  )
}

/**
 * Los filtros dejan de ocupar el cuerpo de la lista (regla 4).
 *
 * Arriba queda una fila de chips: «Filtros» con el número aplicado, un
 * chip por cada filtro activo con su equis, y al lado el conteo de
 * resultados. Los controles se mudan a una hoja inferior.
 *
 * ⚠ Envuelve a `FormularioFiltros`, no lo reemplaza. El
 * `<form method="get">`, los `name` y el `router.push` con `scroll:false`
 * siguen intactos: la URL que se comparte no cambia ni un parámetro.
 *
 * Sin JavaScript la hoja no se abre, así que ni se dibuja el chip que la
 * abriría: en su lugar queda el formulario de siempre, visible, con su
 * botón «Filtrar». La detección es `useSyncExternalStore`, el mismo patrón
 * que ya usa `SelectFiltro` para degradarse a `<select>` nativo, que es la
 * forma sancionada de decir «esto solo en cliente» sin desajustar la
 * hidratación.
 *
 * La hoja es el `popover` nativo, igual que el panel de `BotonAvisos`:
 * cerrar al tocar fuera, `Escape` y el manejo de foco los da el navegador.
 * No los implementes a mano.
 */
export function HojaFiltros({
  action,
  id,
  titulo,
  aplicados,
  conteo,
  children,
}: {
  /** La ruta, sin query. */
  action: string
  /** Id del `popover`. Único por pantalla. */
  id: string
  /** Encabezado de la hoja: «Filtrar solicitudes». */
  titulo: string
  aplicados: ChipAplicado[]
  /** El conteo de resultados, ya redactado por la página. */
  conteo?: ReactNode
  children: ReactNode
}) {
  const hidratado = useSyncExternalStore(sinSuscripcion, enCliente, enServidor)
  // El elemento en estado y no en `useRef`: hay dos cosas que solo pueden
  // hacerse cuando existe de verdad —oír su `toggle` y dárselo a los
  // desplegables como contenedor del portal— y con una `ref` el componente
  // no se entera de que ha aparecido. En la primera pintada del cliente
  // `useSyncExternalStore` devuelve todavía la instantánea del servidor,
  // así que la hoja ni siquiera está en el árbol.
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  // Al cerrar sin aplicar, los controles vuelven a lo que dice la URL. Sin
  // esto, quien marca «Agua», se arrepiente y toca fuera, reabre la hoja y
  // ve «Agua» marcado sin que esté filtrando por eso. El contador remonta
  // a los hijos, que es lo único que también devuelve a su sitio el estado
  // interno de `SelectFiltro`.
  const [generacion, setGeneracion] = useState(0)

  useEffect(() => {
    if (!panel) return
    const alCerrar = (e: Event) => {
      if ((e as ToggleEvent).newState === 'closed') setGeneracion((g) => g + 1)
    }
    panel.addEventListener('toggle', alCerrar)
    return () => panel.removeEventListener('toggle', alCerrar)
  }, [panel])

  function cerrar() {
    panel?.hidePopover()
  }

  const cabecera = (
    <div className="mt-3">
      <div className="riel -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {hidratado && (
          <button
            type="button"
            popoverTarget={id}
            className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-primary bg-accent px-4 text-base font-medium text-accent-foreground"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtros
            {aplicados.length > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
                {aplicados.length}
              </span>
            )}
          </button>
        )}
        {aplicados.map((a) => (
          // Todo el chip quita el filtro, no solo la equis: en un teléfono
          // una equis de 16 px es un objetivo que se falla.
          <Link
            key={a.clave}
            href={a.href}
            scroll={false}
            aria-label={`Quitar el filtro ${a.etiqueta}`}
            className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-border bg-secondary px-4 text-base text-secondary-foreground transition-colors hover:bg-muted"
          >
            {a.etiqueta}
            <X className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        ))}
      </div>
      {conteo && (
        <p aria-live="polite" className="mt-3 text-base text-muted-foreground">
          {conteo}
        </p>
      )}
    </div>
  )

  if (!hidratado) {
    return (
      <>
        {cabecera}
        <FormularioFiltros
          action={action}
          variante="outline"
          className="mt-3 flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-sm"
        >
          {children}
        </FormularioFiltros>
      </>
    )
  }

  return (
    <>
      {cabecera}

      {/*
        ⚠ Sin clase de `display`. La hoja del navegador esconde el popover
        cerrado con `[popover]:not(:popover-open){display:none}`, y una
        utilidad de autor —`flex`, `block`— le gana y lo deja visible
        siempre. El `flex` va en el envoltorio de dentro. Es la misma razón
        por la que `BotonAvisos` tampoco pone `display`.

        `top-auto` sí hace falta: la hoja del navegador pone `inset:0`, y
        sin anularlo la hoja se estira de arriba abajo en vez de quedarse
        pegada al borde inferior.
      */}
      <div
        ref={setPanel}
        id={id}
        popover="auto"
        aria-label={titulo}
        className="hoja-inferior fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88vh] w-full max-w-none rounded-t-2xl border-t border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-foreground/40"
      >
        <div className="mx-auto flex max-h-[88vh] max-w-lg flex-col">
          <div className="shrink-0 px-4 pt-2">
            <div
              aria-hidden="true"
              className="mx-auto h-1 w-10 rounded-full bg-border"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <h2 className="font-heading text-2xl">{titulo}</h2>
              <button
                type="button"
                popoverTarget={id}
                popoverTargetAction="hide"
                aria-label="Cerrar"
                className="-mr-2 flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <FormularioFiltros
            action={action}
            className="flex min-h-0 flex-1 flex-col"
            pie={(pendiente) => (
              <div className="flex shrink-0 items-center gap-3 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {/* Texto, sin relleno: quitar todo no es la acción
                    principal de la hoja. */}
                <Link
                  href={action}
                  scroll={false}
                  onClick={cerrar}
                  className="inline-flex min-h-12 shrink-0 items-center rounded-full px-3 text-base text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Quitar todo
                </Link>
                {/* Sin número. El conteo de la selección pendiente exigiría
                    una consulta por cada toque, y el diseño es explícito:
                    antes sin número que un número inventado en el cliente. */}
                <Button type="submit" className="flex-1" disabled={pendiente} onClick={cerrar}>
                  {pendiente ? 'Buscando…' : 'Ver resultados'}
                </Button>
              </div>
            )}
          >
            {/* Los desplegables largos se portalizan DENTRO de la hoja, no
                en el `body`: la hoja está en la capa superior del navegador
                y una lista montada fuera se pinta debajo. Ver
                `contenedor-hoja.ts`. */}
            <ContenedorHoja.Provider value={panel}>
              <div key={generacion} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
                {children}
              </div>
            </ContenedorHoja.Provider>
          </FormularioFiltros>
        </div>
      </div>
    </>
  )
}
