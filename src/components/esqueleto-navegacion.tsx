import { Skeleton } from '@/components/ui/skeleton'

/**
 * Las siluetas que se ven mientras llega la pantalla siguiente.
 *
 * Las monta `BarraDeCarga`, que es quien sabe cuándo empieza y cuándo
 * acaba una navegación. Aquí solo se decide QUÉ forma tiene el hueco.
 *
 * La forma sale del destino, no de la pantalla actual: al tocar un enlace
 * ya sabemos a dónde va, y una silueta con la forma equivocada es peor que
 * ninguna — el contenido salta de sitio al llegar, que es justo lo que un
 * esqueleto viene a evitar.
 */

/** Cuántas siluetas caben en un teléfono sin desplazar. Más es tinta que nadie ve. */
const CUANTAS = 4

function Tarjeta() {
  return (
    <li className="shadow-canto rounded-2xl bg-card p-4">
      <Skeleton className="h-5 w-1/3 rounded-full" />
      <Skeleton className="mt-2 h-4 w-2/3 rounded-full" />
      <Skeleton className="mt-3 h-4 w-full rounded-full" />
    </li>
  )
}

function Lista() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: CUANTAS }, (_, i) => (
        <Tarjeta key={i} />
      ))}
    </ul>
  )
}

function Rejilla() {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {Array.from({ length: CUANTAS }, (_, i) => (
        <li key={i} className="shadow-canto overflow-hidden rounded-2xl bg-card">
          {/* La foto manda en la tarjeta de producto: sin ella reservada, al
              llegar empuja todo lo de abajo. */}
          <Skeleton className="h-40 w-full rounded-none" />
          <div className="p-4">
            <Skeleton className="h-4 w-2/3 rounded-full" />
            <Skeleton className="mt-2 h-4 w-1/3 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Filas() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="shadow-canto flex min-h-14 items-center rounded-xl bg-card px-4">
          <Skeleton className="h-4 w-1/2 rounded-full" />
        </li>
      ))}
    </ul>
  )
}

function Formulario() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i}>
          <Skeleton className="h-4 w-1/4 rounded-full" />
          {/* `h-12` es la altura real de los campos: la de un área táctil. */}
          <Skeleton className="mt-2 h-12 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

const FORMAS = {
  lista: Lista,
  rejilla: Rejilla,
  filas: Filas,
  formulario: Formulario,
} as const

/** Qué destino lleva qué forma. Lo que no esté aquí es una lista. */
const POR_DESTINO: [RegExp, keyof typeof FORMAS][] = [
  [/^\/(barrio|donaciones|categorias)(\/|$)/, 'rejilla'],
  [/^\/zonas(\/|$)/, 'filas'],
  [/^\/(perfil|empezar|login)(\/|$)/, 'formulario'],
]

export function EsqueletoDeNavegacion({ destino }: { destino: string }) {
  const clave = POR_DESTINO.find(([patron]) => patron.test(destino))?.[1] ?? 'lista'
  const Forma = FORMAS[clave]

  return (
    // `flex-1` porque ocupa el sitio de `#contenido`, que lo es: sin esto
    // el pie sube y se queda a media pantalla.
    <div className="flex-1" data-esqueleto-navegacion role="status">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true" className="mx-auto max-w-2xl px-4 py-6">
        <Forma />
      </div>
    </div>
  )
}
