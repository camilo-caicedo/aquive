import Link from 'next/link'

export interface Pestana {
  href: string
  etiqueta: string
  activa: boolean
  /** Número al lado de la etiqueta: respuestas, pendientes, lo que sea. */
  cuenta?: number
}

/**
 * La misma barra de píldoras que ya usaban la portada y /servidores, ahora
 * en un solo sitio. Enlaces con el estado en la URL, no estado de cliente:
 * se puede compartir, el atrás del navegador funciona y no hace falta
 * JavaScript.
 *
 * Existe porque cuatro pantallas —solicitud, perfil, organización y
 * moderación— habían crecido hasta ser un rollo vertical donde todo
 * competía por la atención. Separar en pestañas no es decoración: cada
 * pestaña consulta solo lo suyo, así que además se carga menos.
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
      <ul className="flex gap-2">
        {pestanas.map((p) => (
          <li key={p.href} className="shrink-0">
            <Link
              href={p.href}
              aria-current={p.activa ? 'page' : undefined}
              // Alto mínimo de 48px como el resto: se usa desde el celular
              // y de pie. El color no es la única señal — la píldora activa
              // cambia de fondo, no solo de tinte.
              className={`inline-flex min-h-12 items-center gap-1.5 rounded-full border px-4 text-base transition-colors ${
                p.activa
                  ? 'border-primary bg-primary font-medium text-primary-foreground'
                  : 'border-border bg-card hover:bg-muted'
              }`}
            >
              {p.etiqueta}
              {p.cuenta !== undefined && p.cuenta > 0 && (
                <span
                  className={`rounded-full px-2 text-sm ${
                    p.activa ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
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
