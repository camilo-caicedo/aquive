import Link from 'next/link'
import { Briefcase, Building2, Stethoscope } from 'lucide-react'

/**
 * Las tres listas de «quién puede hacer algo por mí», bajo un solo destino
 * de la navegación.
 *
 * Son tres módulos distintos —rutas distintas, tablas distintas y, en el
 * caso de Oficios, otro responsable del tratamiento— pero para quien busca
 * son la misma pregunta, y la barra inferior tiene un tope de cinco
 * destinos. Lo que se unifica es por dónde se entra, no lo que hay detrás.
 *
 * Enlaces y no pestañas con estado: la pestaña vive en la URL, así que se
 * puede pegar en un grupo de WhatsApp. Mismo patrón que ya tenía
 * /servidores con sus dos listas.
 */
const PESTANAS = [
  { clave: 'oficios', href: '/servicios', etiqueta: 'Oficios', Icono: Briefcase },
  {
    clave: 'profesionales',
    href: '/servidores?ver=profesionales',
    etiqueta: 'Profesionales',
    Icono: Stethoscope,
  },
  { clave: 'entidades', href: '/servidores', etiqueta: 'Entidades', Icono: Building2 },
] as const

export type PestanaServicios = (typeof PESTANAS)[number]['clave']

export function PestanasServicios({ activa }: { activa: PestanaServicios }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Qué lista ver">
      {PESTANAS.map(({ clave, href, etiqueta, Icono }) => {
        const esta = clave === activa
        return (
          <Link
            key={clave}
            href={href}
            aria-current={esta ? 'page' : undefined}
            className={`inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-base transition-colors sm:flex-initial sm:px-4 ${
              esta
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-muted'
            }`}
          >
            <Icono className="size-4 shrink-0" aria-hidden="true" />
            {etiqueta}
          </Link>
        )
      })}
    </div>
  )
}
