import type { Categoria } from '@/lib/types'

// Datos planos de las categorías: el valor y su etiqueta legible, sin nada
// de UI. Viven aparte de `catalogo.ts` porque aquel adjunta iconos de
// lucide-react (componentes de React), y hay código de servidor —el worker
// de avisos, que corre en un cron sin petición— que necesita la etiqueta
// sin cargar UI. `catalogo.ts` construye `CATEGORIAS` a partir de esto.
//
// El orden manda: 'otros' va de último porque `categoria()` lo usa como
// respaldo.
export const CATEGORIAS_ETIQUETA: { valor: Categoria; etiqueta: string }[] = [
  { valor: 'alimentacion', etiqueta: 'Alimentación' },
  { valor: 'aseo', etiqueta: 'Aseo' },
  { valor: 'salud', etiqueta: 'Salud' },
  { valor: 'abrigo', etiqueta: 'Abrigo' },
  { valor: 'cocina', etiqueta: 'Cocina' },
  { valor: 'mascotas', etiqueta: 'Mascotas' },
  { valor: 'servicios', etiqueta: 'Servicios profesionales' },
  { valor: 'otros', etiqueta: 'Otros' },
]
