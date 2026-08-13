import { calcularFrescura } from '@/lib/tiempo'

const ESTILOS = {
  reciente: 'border-green-300 bg-green-50 text-green-900',
  activa: 'border-amber-300 bg-amber-50 text-amber-900',
  antigua: 'border-border bg-muted text-muted-foreground',
} as const

const PUNTOS = {
  reciente: 'bg-green-600',
  activa: 'bg-amber-600',
  antigua: 'bg-muted-foreground',
} as const

const ETIQUETAS = {
  reciente: 'Reciente',
  activa: 'Activa',
  antigua: 'Antigua',
} as const

// Tres señales redundantes (color, texto, punto de forma fija) para que el
// estado no dependa de percibir el color — daltonismo, pantallas de gama
// baja con mal contraste de color.
export function BadgeFrescura({ horas }: { horas: number }) {
  const frescura = calcularFrescura(horas)
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${ESTILOS[frescura]}`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${PUNTOS[frescura]}`} />
      {ETIQUETAS[frescura]}
    </span>
  )
}
