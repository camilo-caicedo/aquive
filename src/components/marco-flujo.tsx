import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * El caparazón de las pantallas de flujo: publicar, responder, calificar,
 * entrar.
 *
 * Regla 10 del sistema de diseño: destino o flujo, nunca las dos cosas. Un
 * destino lleva la marca arriba y la barra inferior —se entra a mirar y se
 * sale a cualquier parte—. Un flujo lleva volver y título, no lleva barra,
 * y su acción es una barra fija abajo. Dejar la barra dentro de un
 * formulario ofrece cuatro salidas a medio llenar y le roba 64 px al campo
 * que se está escribiendo.
 *
 * La barra inferior se esconde desde `globals.css`, con `:has()` sobre el
 * `data-marco-flujo` de aquí abajo. Es CSS y no JavaScript a propósito:
 * así ya es correcto en la primera pintada del servidor, y no hay un
 * cuadro en el que la barra aparece y desaparece.
 */
export function MarcoFlujo({
  titulo,
  volver,
  pasos,
  pasoActual = 0,
  accion,
  children,
}: {
  titulo: string
  /** A dónde vuelve. Sin esto no se dibuja el botón. */
  volver?: string
  /** Los pasos, con nombre. «Paso 3 de 5» no dice de qué. */
  pasos?: string[]
  /** Índice del paso actual, empezando en 0. */
  pasoActual?: number
  /** Lo que va en la barra fija de abajo. Normalmente un botón. */
  accion?: ReactNode
  children: ReactNode
}) {
  return (
    <div data-marco-flujo>
      <div className="mx-auto max-w-lg px-4 py-4">
        <div className="flex items-center gap-1">
          {volver && (
            <Link
              href={volver}
              aria-label="Volver"
              className="-ml-3 flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-6" aria-hidden="true" />
            </Link>
          )}
          <h1 className="font-heading text-2xl">{titulo}</h1>
        </div>

        {pasos && pasos.length > 0 && (
          // El paso actual se marca con texto —«Paso 2 de 3»— y con peso,
          // no solo con color (regla 9): en una pantalla al sol, o para
          // quien no distingue la terracota del papel, la barrita sola no
          // dice nada.
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">
              Paso {pasoActual + 1} de {pasos.length}
            </p>
            <ol className="mt-1 flex gap-1.5">
              {pasos.map((nombre, i) => (
                <li key={nombre} className="flex-1">
                  <span
                    aria-current={i === pasoActual ? 'step' : undefined}
                    className={`block border-t-2 pt-1.5 text-sm ${
                      i === pasoActual
                        ? 'border-primary font-semibold text-foreground'
                        : i < pasoActual
                          ? 'border-ok text-muted-foreground'
                          : 'border-border text-muted-foreground'
                    }`}
                  >
                    {nombre}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-4">{children}</div>
      </div>

      {accion && (
        <>
          {/* En flujo, para que la barra no tape el final del formulario. */}
          <div aria-hidden="true" className="h-24" />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto max-w-lg px-4 py-3">{accion}</div>
          </div>
        </>
      )}
    </div>
  )
}
