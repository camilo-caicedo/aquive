'use client'

import dynamic from 'next/dynamic'

import type { Acopio } from '@/contrato/acopios'
import { Skeleton } from '@/components/ui/skeleton'

// Igual que el de prestadores: Leaflet toca `window` al importarse, así que
// el mapa entra solo en el navegador y no le cuesta 42 KB a quien nunca
// abre esta pantalla.
const Mapa = dynamic(() => import('@/components/mapa').then((m) => m.Mapa), {
  ssr: false,
  loading: () => (
    <Skeleton className="shadow-canto h-[360px] w-full rounded-2xl" />
  ),
})

/**
 * Los centros de acopio en el mapa (ADR 0008).
 *
 * ⚠ Todos del mismo color, y no es pereza: un centro de acopio no tiene
 * familia de oficio, y pintarlos de cuatro colores distintos sugeriría una
 * clasificación que no existe. El color aquí solo dice «esto es un punto de
 * entrega», y la palabra la lleva cada globo.
 */
const VERDE = '#38B58C'

export function MapaDeAcopios({ acopios }: { acopios: Acopio[] }) {
  const puntos = acopios
    .filter((a) => a.latitud !== null && a.longitud !== null)
    .map((a) => ({
      id: a.id,
      latitud: a.latitud!,
      longitud: a.longitud!,
      nombre: a.nombre,
      detalle: a.horario,
      color: VERDE,
      // Sin enlace: el centro no tiene ficha propia, y toda su información
      // está en la tarjeta de abajo. Un globo que no lleva a ninguna parte
      // es mejor que uno que lleva a una pantalla vacía.
      href: '/acopios',
    }))

  if (puntos.length === 0) return null

  return <Mapa puntos={puntos} />
}
