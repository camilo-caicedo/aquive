'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HandHeart,
  Stethoscope,
  ListChecks,
  ShieldCheck,
  PackageOpen,
  Building2,
} from 'lucide-react'

const ENLACES = [
  { href: '/', etiqueta: 'Solicitudes', Icono: HandHeart },
  { href: '/ofertadores', etiqueta: 'Quién ofrece', Icono: PackageOpen },
  // "Servicios" y no "Profesionales": esa pantalla ahora tiene dos listas y
  // la primera son las entidades, así que el nombre anterior engañaba.
  { href: '/servidores', etiqueta: 'Servicios', Icono: Stethoscope },
  { href: '/mis-solicitudes', etiqueta: 'Mis solicitudes', Icono: ListChecks },
]

const ENLACE_ADMIN = { href: '/admin', etiqueta: 'Moderación', Icono: ShieldCheck }

// `/aliado` tiene dos públicos y por eso dos nombres. Para el equipo de una
// fundación es su organización; para quien solo ofreció ayuda es el sitio
// donde están sus conversaciones, y llamárselo «Mi organización» sería
// mentirle. Quien no tenga ninguna de las dos cosas no ve la pestaña.
const ETIQUETA_COORDINACION: Record<string, string> = {
  organizacion: 'Mi organización',
  coordinacion: 'Coordinación',
}

// Coincidencia exacta para la portada; por prefijo para el resto, para que
// /responder/ABCD siga marcando "Solicitudes".
function estaActiva(ruta: string, href: string) {
  return href === '/' ? ruta === '/' : ruta.startsWith(href)
}

/**
 * Cliente a propósito, pese al presupuesto de JS.
 *
 * Marcar la pestaña desde el servidor no funciona: el layout no se vuelve
 * a renderizar al navegar con Link, así que el encabezado se quedaba con
 * la ruta de la primera carga y subrayaba la pestaña equivocada. Sin
 * JavaScript los enlaces siguen funcionando; lo único que se pierde es el
 * resaltado, que es decorativo.
 */
export function Navegacion({
  esAdmin,
  menuCoordinacion,
}: {
  esAdmin: boolean
  /** `'organizacion'`, `'coordinacion'` o null. Lo decide el servidor. */
  menuCoordinacion: string | null
}) {
  const ruta = usePathname()
  const etiquetaCoordinacion = menuCoordinacion
    ? ETIQUETA_COORDINACION[menuCoordinacion]
    : undefined

  const enlaces = [
    ...ENLACES,
    ...(etiquetaCoordinacion
      ? [{ href: '/aliado', etiqueta: etiquetaCoordinacion, Icono: Building2 }]
      : []),
    ...(esAdmin ? [ENLACE_ADMIN] : []),
  ]

  return (
    // Scroll horizontal: en pantallas de 320px no caben tres pestañas sin
    // encogerlas por debajo del mínimo táctil.
    <nav aria-label="Secciones" className="mx-auto max-w-3xl overflow-x-auto px-4">
      <ul className="flex gap-1">
        {enlaces.map(({ href, etiqueta, Icono }) => {
          const activa = estaActiva(ruta, href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activa ? 'page' : undefined}
                // Color Y barra inferior: el subrayado se ve aunque no se
                // distinga el color, y sobrevive al alto contraste.
                className={`flex min-h-12 shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 text-base transition-colors ${
                  activa
                    ? 'border-primary font-semibold text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icono className="size-4" aria-hidden="true" />
                {etiqueta}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
