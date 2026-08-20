import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Una pantalla o un hueco que no tiene contenido: vacío, error, sin
 * permiso, cargando.
 *
 * Una frase, una acción y nada más. Estaban escritos ocho veces, cada uno
 * con su redacción y su tamaño de icono, y algunos decían dos cosas a la
 * vez —«no hay nada» y además tres consejos—.
 *
 * ⚠ 404 y «sin permiso» dicen lo mismo a propósito: contestar «no tienes
 * permiso» revela que ese recurso existe, y con un token en la URL eso es
 * un oráculo.
 */
export function Estado({
  Icono,
  titulo,
  detalle,
  accion,
}: {
  Icono?: LucideIcon
  titulo: string
  detalle?: ReactNode
  accion?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      {Icono && (
        <Icono className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
      )}
      <p className="mt-2 text-lg font-medium">{titulo}</p>
      {detalle && <p className="mt-1 text-base text-muted-foreground">{detalle}</p>}
      {accion && <div className="mt-4 flex flex-wrap justify-center gap-2">{accion}</div>}
    </div>
  )
}

/**
 * Siluetas de lo que va a llegar, no la palabra «cargando».
 *
 * Solo opacidad: `latido-suave` ya está en `globals.css` y respeta
 * `prefers-reduced-motion` con el resto.
 */
export function Siluetas({ cuantas = 3 }: { cuantas?: number }) {
  return (
    <ul aria-hidden="true" className="space-y-3">
      {Array.from({ length: cuantas }, (_, i) => (
        <li key={i} className="punto-urgente rounded-2xl bg-card p-4 shadow-sm">
          <div className="h-5 w-1/3 rounded-full bg-muted" />
          <div className="mt-2 h-4 w-2/3 rounded-full bg-muted" />
          <div className="mt-3 h-4 w-full rounded-full bg-muted" />
        </li>
      ))}
    </ul>
  )
}
