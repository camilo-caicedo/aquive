import { Utensils, Droplets, HeartPulse, Shirt, CookingPot, Package } from 'lucide-react'
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
  { valor: 'otros', etiqueta: 'Otros', Icono: Package },
]

export function categoria(valor: Categoria) {
  return CATEGORIAS.find((c) => c.valor === valor) ?? CATEGORIAS[5]
}

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
