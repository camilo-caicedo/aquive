'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HandHeart, Stethoscope, ListChecks, PackageOpen, Building2 } from 'lucide-react'

const ENLACES = [
  { href: '/', etiqueta: 'Solicitudes', Icono: HandHeart },
  { href: '/ofertadores', etiqueta: 'Quién ofrece', Icono: PackageOpen },
  // Un solo destino para las tres listas de «quién puede hacer algo por
  // mí»: oficios del rebusque, profesionales con matrícula y entidades.
  // Detrás son módulos distintos —y el primero tiene otro responsable del
  // tratamiento— pero para quien busca es la misma pregunta, y aquí abajo
  // solo caben cinco celdas. Las tres se reparten en `PestanasServicios`.
  { href: '/servicios', etiqueta: 'Servicios', Icono: Stethoscope },
  { href: '/mis-solicitudes', etiqueta: 'Mis solicitudes', Icono: ListChecks },
]

// `/aliado` tiene dos públicos y por eso dos nombres. Para el equipo de una
// fundación es su organización; para quien solo ofreció ayuda es el sitio
// donde están sus conversaciones, y llamárselo «Mi organización» sería
// mentirle. Quien no tenga ninguna de las dos cosas no ve la pestaña.
const ETIQUETA_COORDINACION: Record<string, string> = {
  organizacion: 'Mi organización',
  coordinacion: 'Coordinación',
}

// La barra de abajo es más angosta que el encabezado y no le caben los dos
// nombres largos. No es otro destino: es el mismo, dicho en una palabra.
const ETIQUETA_CORTA: Record<string, string> = {
  '/ofertadores': 'Ofrecen',
  '/mis-solicitudes': 'Mis solicitudes',
  '/aliado': 'Coordinar',
}

// Rutas que marcan una pestaña sin colgar de ella. Hoy solo una: las tres
// listas de servicios están repartidas en dos rutas —/servicios para los
// oficios, /servidores para profesionales y entidades— y las dos tienen
// que dejar la misma celda encendida. Sin esto, tocar «Profesionales»
// apaga la navegación entera y parece que uno se salió del sitio.
const TAMBIEN: Record<string, string[]> = {
  '/servicios': ['/servidores'],
}

// Coincidencia exacta para la portada; por prefijo para el resto, para que
// /responder/ABCD siga marcando "Solicitudes".
function estaActiva(ruta: string, href: string) {
  if (href === '/') return ruta === '/'
  if (ruta.startsWith(href)) return true
  return (TAMBIEN[href] ?? []).some((otra) => ruta.startsWith(otra))
}

function enlaces(menuCoordinacion: string | null) {
  const etiqueta = menuCoordinacion ? ETIQUETA_COORDINACION[menuCoordinacion] : undefined
  return etiqueta
    ? [...ENLACES, { href: '/aliado', etiqueta, Icono: Building2 }]
    : ENLACES
}

/**
 * Cliente a propósito, pese al presupuesto de JS.
 *
 * Marcar la pestaña desde el servidor no funciona: el layout no se vuelve
 * a renderizar al navegar con Link, así que el encabezado se quedaba con
 * la ruta de la primera carga y subrayaba la pestaña equivocada.
 *
 * Solo para pantallas medianas y grandes. En un teléfono la navegación es
 * `BarraInferior`, aquí abajo.
 */
export function Navegacion({ menuCoordinacion }: { menuCoordinacion: string | null }) {
  const ruta = usePathname()

  return (
    <nav aria-label="Secciones" className="mx-auto hidden max-w-3xl px-4 sm:block">
      <ul className="flex gap-1">
        {enlaces(menuCoordinacion).map(({ href, etiqueta, Icono }) => {
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

/**
 * La navegación del teléfono, abajo y fija.
 *
 * Antes esto era la misma fila de arriba con `overflow-x-auto`. Las
 * pestañas suman 747 px y en un teléfono de 360 no caben ni las cuatro
 * básicas: había que arrastrar para encontrarlas, y nada en pantalla decía
 * que hubiera algo más a la derecha. Una navegación que hay que descubrir
 * no es una navegación.
 *
 * Abajo por dos razones, no por moda: se ve entera de una vez, y queda
 * donde llega el pulgar de quien sostiene el teléfono con una mano —que es
 * como se usa esto, de pie y con prisa—. De paso le devuelve 62 px de alto
 * al contenido, que en una pantalla de 640 es una línea y media de texto.
 *
 * Cinco destinos como máximo. El sexto, moderación, no está aquí ni en la
 * fila de arriba: es una herramienta de administrador, no un destino del
 * producto, y vive junto a la campana en el encabezado.
 *
 * ⚠ Va en el layout, FUERA del encabezado. El encabezado tiene
 * `backdrop-blur`, y `backdrop-filter` convierte al elemento en bloque
 * contenedor de sus descendientes `fixed`: dentro de él, esta barra se
 * anclaría al encabezado en vez de a la ventana.
 */
export function BarraInferior({ menuCoordinacion }: { menuCoordinacion: string | null }) {
  const ruta = usePathname()
  const items = enlaces(menuCoordinacion)

  return (
    <nav
      aria-label="Secciones"
      // `env(safe-area-inset-bottom)` por el indicador de inicio del
      // iPhone: sin esto la última fila de etiquetas queda debajo de la
      // barra negra.
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map(({ href, etiqueta, Icono }) => {
          const activa = estaActiva(ruta, href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activa ? 'page' : undefined}
                // La línea va ARRIBA de la celda, apuntando al contenido,
                // igual que la de la fila de escritorio apunta hacia abajo.
                className={`flex min-h-16 flex-col items-center justify-center gap-1 border-t-2 px-1 pt-0.5 transition-colors ${
                  activa
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                <Icono className="size-5 shrink-0" aria-hidden="true" />
                {/* Caja de dos líneas siempre, aunque la etiqueta ocupe
                    una: así los iconos quedan a la misma altura en toda la
                    barra en vez de subir y bajar celda a celda. */}
                <span
                  className={`flex min-h-[2.1em] items-center text-center text-[0.6875rem] leading-[1.05] ${
                    activa ? 'font-semibold' : ''
                  }`}
                >
                  {ETIQUETA_CORTA[href] ?? etiqueta}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
