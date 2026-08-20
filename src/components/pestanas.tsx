import Link from 'next/link'

export interface Pestana {
  href: string
  etiqueta: string
  activa: boolean
  /** Número al lado de la etiqueta: respuestas, pendientes, lo que sea. */
  cuenta?: number
}

/**
 * La barra de pestañas de todo el sitio. Enlaces con el estado en la URL,
 * no estado de cliente: se puede compartir, el atrás del navegador
 * funciona y cada pestaña consulta solo lo suyo.
 *
 * Existe porque cinco pantallas —solicitud, perfil, organización,
 * moderación y servicios— habían crecido hasta ser un rollo vertical
 * donde todo competía por la atención.
 *
 * ⚠ Antes eran píldoras con borde, iguales a los botones `outline` que
 * suelen ir justo debajo, y en /servicios no se distinguía qué era
 * navegación y qué era una acción. Ahora es un control segmentado —una
 * sola pieza con fondo apagado, y la activa levantada en blanco—, que se
 * lee como «un grupo donde eliges uno» y no como «tres botones sueltos».
 * Es la forma del componente Tabs de shadcn sobre Base UI.
 *
 * No usa `Tabs` de Base UI a propósito: aquello monta paneles y estado en
 * el cliente, y esto son enlaces a rutas distintas renderizadas en el
 * servidor. Se toma la apariencia, no la maquinaria.
 *
 * El alto sigue en 48 px, que es lo que manda CLAUDE.md aunque el
 * original de shadcn sea más bajo: esto se toca de pie y con prisa.
 */
export function Pestanas({
  etiqueta,
  pestanas,
}: {
  /** Para el lector de pantalla: «Secciones de tu solicitud». */
  etiqueta: string
  pestanas: Pestana[]
}) {
  return (
    <nav aria-label={etiqueta} className="-mx-4 overflow-x-auto px-4">
      <ul className="inline-flex w-full min-w-fit items-center gap-1 rounded-xl bg-muted p-1">
        {pestanas.map((p) => (
          <li key={p.href} className="min-w-fit flex-1">
            <Link
              href={p.href}
              aria-current={p.activa ? 'page' : undefined}
              // La activa va en primario, no en el papel del fondo: sobre
              // el papel cálido de este sitio, un blanco sobre beige casi
              // no se distingue —y menos con el sol de frente, que es
              // donde de verdad se usa esto—. El contraste es de color y
              // de peso, no solo de tono.
              className={`inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-base whitespace-nowrap transition-colors ${
                p.activa
                  ? 'bg-primary font-medium text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.etiqueta}
              {p.cuenta !== undefined && p.cuenta > 0 && (
                <span
                  className={`rounded-full px-2 text-sm ${
                    p.activa
                      ? 'bg-primary-foreground/20'
                      : 'bg-background text-muted-foreground'
                  }`}
                >
                  {p.cuenta}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
