import Link from 'next/link'
import { ChevronRight, type LucideIcon } from 'lucide-react'

/**
 * El gajo de la sombrilla que le toca a cada cola.
 *
 * ⚠ No dice nada por sí solo y no puede: es el color de cartel que hace
 * reconocible una fila a media pantalla, y el nombre de la cola va siempre
 * al lado (regla 9 y ADR 0002). Sobre el azul la tinta del cuadro es
 * blanca; sobre los otros tres, negra.
 */
export type Gajo = 'azul' | 'amarillo' | 'verde' | 'rojo'

const CARTEL: Record<Gajo, string> = {
  azul: 'shadow-cartel-azul',
  amarillo: 'shadow-cartel-amarillo',
  verde: 'shadow-cartel-verde',
  rojo: 'shadow-cartel-rojo',
}

const CUADRO: Record<Gajo, string> = {
  azul: 'bg-familia-azul text-white',
  amarillo: 'bg-familia-amarillo text-foreground',
  verde: 'bg-familia-verde text-foreground',
  rojo: 'bg-familia-rojo text-foreground',
}

export interface Cola {
  href: string
  Icono: LucideIcon
  etiqueta: string
  /** Qué hay dentro, en una línea. Opcional: no toda cola necesita una. */
  detalle?: string
  /** El número de la derecha. Sin él, la fila no lleva contador. */
  cuantas?: number
  /** El color de cartel de la fila. Va con la palabra, nunca solo. */
  gajo?: Gajo
  /**
   * Si detrás de ese número hay una persona esperando.
   *
   * ⚠ Es lo único que saca el número del cuerpo de la fila y lo pone en el
   * cuadro de color de la izquierda, y por eso no es un `destacada` ni un
   * `urgente`: el color no marca importancia, marca espera. Si algún día
   * una cola deja de tener a alguien detrás, pierde el cuadro aunque siga
   * teniendo trabajo dentro.
   *
   * ⚠ Y nunca va solo: la fila que espera lleva además la palabra
   * «Esperando» escrita (regla 9).
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
          <h2 className="font-heading text-xs tracking-[0.085em] uppercase text-muted-foreground">
            {g.titulo}
          </h2>
          <ul className="mt-2.5 space-y-3">
            {g.colas.map((c) => {
              const esperando = !!c.espera && (c.cuantas ?? 0) > 0
              const gajo = c.gajo ?? 'azul'
              return (
                <li key={c.href}>
                  <Link
                    href={c.href}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-3 transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
                      esperando ? CARTEL[gajo] : 'shadow-canto hover:bg-muted'
                    }`}
                  >
                    {/* El cuadro de color con el número dentro es de las
                        colas que tienen a alguien esperando. El resto
                        entra con su icono, que es lo que dice de qué es la
                        cola sin gritar. */}
                    {esperando ? (
                      <span
                        aria-hidden="true"
                        className={`flex size-13 shrink-0 items-center justify-center rounded-xl font-heading text-2xl ${CUADRO[gajo]}`}
                      >
                        {c.cuantas}
                      </span>
                    ) : (
                      <c.Icono
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-heading text-lg leading-tight">
                        {c.etiqueta}
                      </span>
                      {c.detalle && (
                        <span className="mt-0.5 block truncate text-base text-muted-foreground">
                          {c.detalle}
                        </span>
                      )}
                      {/* La palabra, para que el cuadro de color no sea el
                          único que dice que aquí hay alguien esperando. */}
                      {esperando && (
                        <span className="mt-1 block text-base font-semibold">
                          {c.cuantas === 1 ? 'Esperando 1' : `Esperando ${c.cuantas}`}
                        </span>
                      )}
                    </span>
                    {!esperando && c.cuantas !== undefined && c.cuantas > 0 && (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-bold text-secondary-foreground">
                        {c.cuantas}
                      </span>
                    )}
                    <ChevronRight
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
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
