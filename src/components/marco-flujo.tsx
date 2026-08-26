import type { ReactNode } from 'react'
import { BotonVolver } from '@/components/volver'

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
  subtitulo,
  sello,
  volver,
  pasos,
  pasoActual = 0,
  accion,
  children,
}: {
  titulo: string
  /** Una línea de contexto bajo el título: «M9Q · Ana ofrece · tú coordinas». */
  subtitulo?: ReactNode
  /** Estado en palabras, a la derecha del título: «Acordada». */
  sello?: ReactNode
  /** A dónde vuelve cuando no hay historia detrás. Sin esto no se dibuja
   *  la flecha. Ver `BotonVolver`. */
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
      {/* Cabecera y progreso son un bloque, cerrado por una línea: el
          contenido del paso empieza después. */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-lg px-4 pt-2 pb-3">
          <div className="flex items-start gap-1">
            {volver && (
              <BotonVolver href={volver} />
            )}
            <div className="min-w-0 flex-1 py-2.5">
              <h1 className="font-heading text-2xl leading-tight">{titulo}</h1>
              {subtitulo && (
                <p className="mt-0.5 text-base text-muted-foreground">{subtitulo}</p>
              )}
            </div>
            {sello && <span className="mt-2.5 shrink-0">{sello}</span>}
          </div>

          {pasos && pasos.length > 0 && (
            // Una barra por paso y su nombre debajo. El actual se marca con
            // peso y con color, y los ya hechos con la barra llena: el
            // estado no puede depender solo del color (regla 9), y por eso
            // el nombre del paso actual va además en negrita.
            <ol className="mt-3 flex gap-2" aria-label="Progreso">
              {pasos.map((nombre, i) => (
                <li key={nombre} className="min-w-0 flex-1">
                  <span
                    aria-hidden="true"
                    className={`block h-1 rounded-full ${
                      i <= pasoActual ? 'bg-primary' : 'bg-secondary'
                    }`}
                  />
                  <span
                    aria-current={i === pasoActual ? 'step' : undefined}
                    className={`mt-1.5 block truncate text-sm ${
                      i === pasoActual
                        ? 'font-semibold text-enlace'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {nombre}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4">{children}</div>

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
