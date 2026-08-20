import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface Cola {
  href: string
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
      {colas.map((c) => {
        return (
          <li key={c.href}>
            <Link
              href={c.href}
              aria-current={c.activa ? 'page' : undefined}
              className={`flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${c.activa ? 'bg-card shadow-sm' : 'hover:bg-muted'}`}
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                  c.cuantas > 0
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {c.cuantas}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium">{c.etiqueta}</span>
                <span className="block truncate text-sm text-muted-foreground">{c.detalle}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
