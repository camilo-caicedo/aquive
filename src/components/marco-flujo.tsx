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
  /** Los pasos, con nombre. Se pinta «Paso 3 de 5 · Ubicación»: el número
   *  dice cuánto falta y el nombre dice de qué. Ninguno de los dos solo. */
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
            // Una barra por paso, y debajo UNA línea: «Paso 2 de 6 ·
            // Ubicación».
            //
            // ⚠ Antes iba el nombre de cada paso debajo de su propia barra.
            // Con tres pasos se leía; con seis, cada nombre se queda en
            // sesenta píxeles de un teléfono y `truncate` los deja en
            // «Info…», «Prod…», que no dicen nada. Y faltaba lo que el
            // cliente pidió con todas las letras el 3 de septiembre de
            // 2026: «Mostrar siempre: Paso 2 de 6. Esto ayuda a que la
            // persona sepa cuánto falta.»
            //
            // Así van las dos cosas —cuánto falta y de qué— en una línea
            // que cabe. El estado sigue sin depender del color: las barras
            // llenas y el número dicen lo mismo por dos vías (regla 9).
            <div className="mt-3">
              <ol className="flex gap-2" aria-hidden="true">
                {pasos.map((nombre, i) => (
                  <li
                    key={nombre}
                    className={`h-1 min-w-0 flex-1 rounded-full ${
                      i <= pasoActual ? 'bg-primary' : 'bg-secondary'
                    }`}
                  />
                ))}
              </ol>
              <p className="mt-1.5 text-sm text-muted-foreground">
                <span className="font-semibold text-enlace">
                  Paso {pasoActual + 1} de {pasos.length}
                </span>
                {pasos[pasoActual] && ` · ${pasos[pasoActual]}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Los tres `data-flujo` son los ganchos con los que `globals.css`
          rearma esta pantalla dentro de una hoja modal: cuerpo que scrollea,
          hueco que sobra y barra que deja de ser `fixed`. En una pantalla
          normal no hacen nada. */}
      <div data-flujo="cuerpo" className="mx-auto max-w-lg px-4 py-4">{children}</div>

      {accion && (
        <>
          {/* En flujo, para que la barra no tape el final del formulario.
              A la medida de la más alta, que es la de contacto de la ficha:
              aviso y dos botones. */}
          <div aria-hidden="true" data-flujo="hueco" className="h-36" />
          {/* `fixed` contra la ventana en una pantalla normal. Dentro de una
              hoja modal deja de serlo: la hoja es una columna flex y esta
              barra es su último renglón, que es lo único que la mantiene
              abajo cuando el contenedor que scrollea es otro. */}
          <div data-flujo="barra" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto max-w-lg px-4 py-3">{accion}</div>
          </div>
        </>
      )}
    </div>
  )
}
