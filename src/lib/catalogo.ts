import {
  Utensils,
  Droplets,
  HeartPulse,
  Shirt,
  CookingPot,
  Package,
  Stethoscope,
  PawPrint,
} from 'lucide-react'
import type { Categoria } from '@/lib/types'

export const CATEGORIAS: {
  valor: Categoria
  etiqueta: string
  Icono: typeof Utensils
}[] = [
  { valor: 'alimentacion', etiqueta: 'Alimentación', Icono: Utensils },
  { valor: 'aseo', etiqueta: 'Aseo', Icono: Droplets },
  { valor: 'salud', etiqueta: 'Salud', Icono: HeartPulse },
  { valor: 'abrigo', etiqueta: 'Abrigo', Icono: Shirt },
  { valor: 'cocina', etiqueta: 'Cocina', Icono: CookingPot },
  { valor: 'mascotas', etiqueta: 'Mascotas', Icono: PawPrint },
  { valor: 'servicios', etiqueta: 'Servicios profesionales', Icono: Stethoscope },
  // 'otros' va de último a propósito: `categoria()` lo usa como respaldo.
  { valor: 'otros', etiqueta: 'Otros', Icono: Package },
]

export function categoria(valor: Categoria) {
  return CATEGORIAS.find((c) => c.valor === valor) ?? CATEGORIAS[CATEGORIAS.length - 1]
}

// Un servicio no se cuenta por unidades: "1 servicio de Fisioterapia" se
// lee mal. En esos ítems se muestra solo el nombre.
//
// El "por confirmar" va aquí y no en cada pantalla porque son tres —el
// tablero, la pantalla de responder y la del propio solicitante— y la
// única forma de que digan lo mismo es que salga del mismo sitio. Es
// texto, no un badge: funciona sin JavaScript y no gasta nada.
export function describirItem(it: {
  nombre: string
  cantidad: number
  unidad: string
  por_confirmar?: boolean
}) {
  const base = it.unidad === 'servicio' ? it.nombre : `${it.cantidad} ${it.unidad} de ${it.nombre}`
  return it.por_confirmar ? `${base} · por confirmar` : base
}

// Cuántas cosas se pueden marcar a la vez en "¿quién necesita lo que
// tengo?". Es el mismo número que el tope de ítems por solicitud, para no
// sostener dos cifras distintas en la cabeza.
//
// ⚠ Vive aquí y no junto al selector porque ese archivo es `'use client'`:
// una constante exportada desde un módulo de cliente, importada por un
// Server Component, no llega como valor sino como referencia de cliente.
// `slice(0, TOPE_SELECCION)` acababa siendo `slice(0, NaN)` y la selección
// entera se descartaba en silencio, sin ningún error.
export const TOPE_SELECCION = 12

// Una solicitud "por vencer" es la que se borra sola en menos de 12 horas.
// Es el momento en que una respuesta todavía alcanza a servir.
export const HORAS_POR_VENCER = 12

export function horasParaVencer(expiraAt: string): number {
  return (new Date(expiraAt).getTime() - Date.now()) / 3_600_000
}

// Instante a partir del cual una solicitud cuenta como "por vencer".
// Vive aquí y no en el componente porque leer el reloj es impuro y no
// debe ocurrir en el cuerpo de un render.
export function limitePorVencer(): string {
  return new Date(Date.now() + HORAS_POR_VENCER * 3_600_000).toISOString()
}
