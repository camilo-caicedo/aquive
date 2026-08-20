import Link from 'next/link'
import { ChevronRight, type LucideIcon } from 'lucide-react'

export interface Cola {
  href: string
  Icono: LucideIcon
  etiqueta: string
  /** Qué hay que hacer con esa cola, en una línea. */
  detalle: string
  cuantas: number
  activa: boolean
}

/**
 * La portada de `/admin`: una fila por cola, con su número, y debajo la
 * cola abierta.
 *
 * Antes eran seis pestañas de igual peso y había que entrar en cada una
 * para saber si tenía algo. Lo que se viene a hacer aquí es saber si hay
 * trabajo pendiente y cuál, así que eso va primero y en números.
 *
 * Las colas con cero se dibujan apagadas pero no se esconden: que una cola
 * exista y esté vacía es información, y una lista que cambia de tamaño
 * cada vez desorienta más de lo que ahorra.
 */
export function ColaTrabajo({ colas }: { colas: Cola[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {colas.map((c) => (
        <li key={c.href}>
          <Link
            href={c.href}
            aria-current={c.activa ? 'page' : undefined}
            className={`flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${
              c.activa
                ? 'border border-primary bg-accent text-accent-foreground'
                : 'bg-card shadow-sm hover:bg-muted'
            }`}
          >
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                c.activa ? 'bg-background text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              <c.Icono className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium">{c.etiqueta}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {c.detalle}
              </span>
            </span>
            {/* El número a la derecha, en círculo cuando hay algo: es lo que
                se viene a mirar, y en la izquierda competía con el icono. */}
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                c.cuantas > 0
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {c.cuantas}
            </span>
            {!c.activa && (
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
