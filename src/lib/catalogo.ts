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
