import { calcularFrescura } from '@/lib/tiempo'

// Los tokens de la identidad, no los verdes y ámbares de Tailwind: sobre el
// papel cálido del fondo aquellos se veían de otra paleta.
const ESTILOS = {
  reciente: 'border-ok/30 bg-ok-suave text-ok',
  activa: 'border-primary/25 bg-accent text-accent-foreground',
  antigua: 'border-border bg-muted text-muted-foreground',
} as const

const PUNTOS = {
  reciente: 'bg-ok',
  activa: 'bg-primary',
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
