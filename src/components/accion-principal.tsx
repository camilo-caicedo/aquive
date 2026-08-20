import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

type Comun = {
  /** Lo que hace, en dos o tres palabras: «Necesito ayuda», «Guardar». */
  etiqueta: string
  Icono: LucideIcon
  /** `false` no la dibuja. Una pantalla sin acción principal no la monta. */
  visible?: boolean
}

type Props = Comun &
  (
    | { href: string; onClick?: never }
    | { href?: never; onClick: () => void }
  )

/**
 * La acción principal de una pantalla, en una píldora fija sobre la barra.
 *
 * Sale del cuerpo de la página a propósito: dentro competía con la
 * pestaña activa, que hasta ahora usaba el mismo relleno terracota, y en
 * una lista larga quedaba fuera de pantalla justo cuando hacía falta.
 * Aquí es la única terracota de la pantalla (regla 2) y está donde llega
 * el pulgar.
 *
 * La monta cada página, no el layout: cada pantalla declara la suya y la
 * que no tiene, no la pinta. Sin JavaScript sigue siendo un enlace.
 *
 * ⚠ Va fuera del encabezado, por lo mismo que `BarraInferior`: el
 * encabezado tiene `backdrop-blur`, y `backdrop-filter` convierte al
 * elemento en bloque contenedor de sus descendientes `fixed`.
 *
 * ⚠ Sin `'use client'` a propósito. `Icono` es una referencia a un
 * componente, y eso no cruza la frontera de serialización: con la
 * directiva, cualquier Server Component que le pasara un icono se
 * rompería. Así funciona desde los dos lados —la variante `onClick` solo
 * se monta desde un componente que ya sea cliente—.
 */
export function AccionPrincipal({ etiqueta, Icono, visible = true, href, onClick }: Props) {
  if (!visible) return null

  // `data-accion-principal` no es decorativo: es el gancho de la regla de
  // `globals.css` que le abre sitio al pie de pagina. El separador en flujo
  // de abajo protege la ultima tarjeta de la lista, pero el pie viene
  // DESPUES del `<main>` y ese separador no lo alcanza: la pildora se le
  // sentaba encima y tapaba el ultimo enlace.
  const clases =
    'fixed right-4 z-40 flex h-14 items-center gap-2.5 rounded-full bg-primary px-6 text-lg font-semibold text-primary-foreground shadow-xl transition-transform active:translate-y-px ' +
    // En `sm` la barra inferior no se dibuja, así que sus 4rem sobran.
    'bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] sm:bottom-6'

  const contenido = (
    <>
      <Icono className="size-6" aria-hidden="true" />
      {etiqueta}
    </>
  )

  return (
    <>
      {/* En flujo, para que la píldora no tape la última tarjeta de la
          lista. Se monta al final del `<main>`, y por eso el hueco queda
          donde tiene que quedar sin que cada página lo calcule. */}
      <div aria-hidden="true" className="h-20" />
      {href ? (
        <Link href={href} data-accion-principal className={clases}>
          {contenido}
        </Link>
      ) : (
        <button type="button" data-accion-principal onClick={onClick} className={clases}>
          {contenido}
        </button>
      )}
    </>
  )
}
