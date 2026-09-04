'use client'

import Image from 'next/image'
import Link from 'next/link'

import isotipo from '@/../docs/marca/isotipo-carrito.png'
import {
  BarChart3,
  HandHeart,
  HelpCircle,
  Info,
  Mail,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { HojaAccion } from '@/components/hoja-accion'

// El menú de la sombrilla (ADR 0016). La bienvenida va primera: es lo que
// se pierde en un toque —ir directo a «/»— y lo que este menú compensa.
// «Aliados» y «Datos abiertos» no cuelgan de ninguna celda de la barra,
// igual que estas otras tres: son información del sitio, no «lo mío»
// (mismo criterio que `TAMBIEN` en navegacion.tsx).
const ENLACES_MENU: { href: string; etiqueta: string; Icono: LucideIcon }[] = [
  { href: '/', etiqueta: 'Bienvenida', Icono: Sparkles },
  { href: '/quienes-somos', etiqueta: 'Quiénes somos', Icono: Info },
  { href: '/ayuda', etiqueta: 'Preguntas frecuentes', Icono: HelpCircle },
  { href: '/aliados', etiqueta: 'Aliados', Icono: HandHeart },
  { href: '/datos', etiqueta: 'Datos abiertos', Icono: BarChart3 },
  { href: '/contacto', etiqueta: 'Contacto', Icono: Mail },
]

/**
 * La marca del encabezado, que desde el ADR 0016 abre el menú.
 *
 * ⚠ Vive en su propio archivo cliente y no dentro de `Encabezado` por una
 * razón que no se ve hasta ejecutarlo: `HojaAccion` recibe su disparador
 * como **función**, y `Encabezado` es un Server Component. Pasar una
 * función de un componente de servidor a uno de cliente revienta en
 * ejecución —«Functions cannot be passed directly to Client Components»—
 * y, como el encabezado vive en el layout raíz, se lleva por delante
 * todas las pantallas a la vez.
 *
 * `next build` no lo detecta: compila limpio y falla al primer render. La
 * comprobación de esto es levantar el servidor y abrir una página.
 */
export function MenuSombrilla() {
  return (
    <HojaAccion
      id="menu-sombrilla"
      titulo="Menú de AquíVe"
      disparador={(props) => (
        <button
          {...props}
          aria-haspopup="dialog"
          aria-label="Menú de AquíVe"
          className="pulsable flex min-h-12 shrink-0 items-center gap-2.5 rounded-full"
        >
          {/* El PNG no tiene canal alfa, así que el isotipo va en su
              círculo blanco; suelto sobre el crema se vería un cuadrado. */}
          <span className="size-10 shrink-0 overflow-hidden rounded-full bg-card p-1">
            <Image
              src={isotipo}
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </span>
          {/* El nombre va en TEXTO y no dibujado: el revisor de marca de
              Google lee el DOM. */}
          <span className="bg-primary text-primary-foreground font-heading rounded-full px-3 py-1 text-base leading-none tracking-[0.08em] uppercase">
            Aquí Ve
          </span>
        </button>
      )}
    >
      <nav aria-label="Páginas informativas">
        <ul className="space-y-1">
          {ENLACES_MENU.map(({ href, etiqueta, Icono }) => (
            <li key={href}>
              <Link
                href={href}
                className="pulsable flex min-h-14 items-center gap-3 rounded-xl px-2 text-lg transition-colors hover:bg-muted"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Icono className="size-5" aria-hidden="true" />
                </span>
                {etiqueta}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </HojaAccion>
  )
}
