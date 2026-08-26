'use client'

import dynamic from 'next/dynamic'

import { familiaDe } from '@/lib/familias'
import type { EnListado } from '@/contrato/servicios'

// Leaflet toca `window` al importarse, así que el mapa entra solo en el
// navegador. Y de paso no le cuesta 42 KB a quien nunca abre esta pantalla.
const Mapa = dynamic(() => import('@/components/mapa').then((m) => m.Mapa), {
  ssr: false,
  loading: () => (
    <div className="shadow-canto h-[360px] w-full animate-pulse rounded-2xl bg-muted" />
  ),
})

// Los hex de los cuatro gajos. Leaflet dibuja con estilo en línea dentro de un
// `divIcon`, así que aquí no sirven las clases de Tailwind: hacen falta los
// valores. Son los mismos de `globals.css` — si cambian allá, cambian aquí.
const HEX = {
  azul: '#2860A8',
  amarillo: '#F4C542',
  verde: '#38B58C',
  rojo: '#E86F87',
} as const

export function MapaDeProveedores({ proveedores }: { proveedores: EnListado[] }) {
  const puntos = proveedores
    .filter((p) => p.latitud !== null && p.longitud !== null)
    .map((p) => ({
      id: p.id,
      latitud: p.latitud!,
      longitud: p.longitud!,
      nombre: p.nombre_visible,
      detalle: p.oficios[0]?.nombre ?? null,
      color: HEX[familiaDe(p.oficios[0]?.grupo)],
      href: `/prestador/${p.id}`,
    }))

  if (puntos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
        Todavía nadie con estos filtros puso su ubicación en el mapa.
      </p>
    )
  }

  return <Mapa puntos={puntos} />
}
