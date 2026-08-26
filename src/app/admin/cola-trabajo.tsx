import Link from 'next/link'
import { ChevronRight, type LucideIcon } from 'lucide-react'

export interface Cola {
  href: string
  Icono: LucideIcon
  etiqueta: string
  /** Qué hay dentro, en una línea. Opcional: no toda cola necesita una. */
  detalle?: string
  /** El número de la derecha. Sin él, la fila no lleva contador. */
  cuantas?: number
  /**
   * Si detrás de ese número hay una persona esperando.
   *
   * ⚠ Es lo único que enciende el fondo terracota, y por eso no es un
   * `destacada` ni un `urgente`: el color no marca importancia, marca
   * espera. Si algún día una cola deja de tener a alguien detrás, pierde
   * el fondo aunque siga teniendo trabajo dentro.
   */
  espera?: boolean
}

export interface GrupoColas {
  titulo: string
  colas: Cola[]
}

/**
 * El índice de `/admin`: una fila por cola, con su número, en tres grupos.
 *
 * Reemplaza dos cosas a la vez. Las seis pestañas de igual peso, que en
 * 360 px no cabían y había que arrastrar para descubrir que la de más a la
 * derecha estaba vacía. Y las dos pestañas —Pendientes y Catálogos— que
 * yo mismo había puesto encima de esto: eran un tercer nivel de pestañas
 * para una herramienta que usa una sola persona, y obligaban a elegir un
 * grupo antes de saber si tenía algo dentro.
 *
 * Un índice con números dice lo mismo sin obligar a elegir: se entra a ver
 * si hay algo que atender y eso se responde sin tocar nada.
 *
 * Las colas con cero no se esconden. Que una cola exista y esté vacía es
 * información, y una lista que cambia de tamaño cada vez desorienta más de
 * lo que ahorra.
 */
export function ColaTrabajo({ grupos }: { grupos: GrupoColas[] }) {
  return (
    <div className="mt-4 space-y-5">
      {grupos.map((g) => (
        <section key={g.titulo}>
          <h2 className="text-sm font-semibold text-muted-foreground">{g.titulo}</h2>
          <ul className="mt-2 space-y-2">
            {g.colas.map((c) => {
              const esperando = !!c.espera && (c.cuantas ?? 0) > 0
              return (
                <li key={c.href}>
                  <Link
                    href={c.href}
                    className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 py-2.5 transition-colors ${
                      esperando
                        ? 'border border-enlace/25 bg-accent text-accent-foreground'
                        : 'bg-card shadow-canto hover:bg-muted'
                    }`}
                  >
                    <c.Icono
                      className={`size-5 shrink-0 ${esperando ? '' : 'text-muted-foreground'}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium">{c.etiqueta}</span>
                      {c.detalle && (
                        <span
                          className={`block truncate text-sm ${
                            esperando ? 'text-accent-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {c.detalle}
                        </span>
                      )}
                    </span>
                    {c.cuantas !== undefined && (c.espera || c.cuantas > 0) && (
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          esperando
                            ? 'bg-primary text-primary-foreground'
                            : c.cuantas > 0
                              ? 'bg-secondary text-secondary-foreground'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {c.cuantas}
                      </span>
                    )}
                    {!c.espera && (
                      <ChevronRight
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
