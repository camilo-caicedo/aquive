// Etiquetas y formato del módulo de Servicios.
//
// Las listas cerradas viven aquí y en el CHECK de la base, y son gemelas:
// si se agrega un valor en un lado hay que agregarlo en el otro. La base
// manda —ella rechaza—, esto solo pone las palabras.
//
// Nada de esto es catálogo: los oficios y las zonas sí lo son y salen de
// `catalogo_oficios` y `zonas`, que un administrador puede cambiar sin
// tocar código.

import type {
  DiaSemana,
  FranjaHoraria,
  GrupoOficio,
  MedioPago,
  ModalidadServicio,
  ModoPrecio,
  TipoProveedor,
  UnidadPrecio,
  UrgenciaServicio,
  CapacidadPago,
} from '@/lib/types'

export const MODALIDADES: { valor: ModalidadServicio; etiqueta: string }[] = [
  { valor: 'domicilio', etiqueta: 'Voy a domicilio' },
  { valor: 'local', etiqueta: 'Atiendo en mi local' },
  { valor: 'remoto', etiqueta: 'A distancia' },
]

export const DIAS: { valor: DiaSemana; etiqueta: string; corta: string }[] = [
  { valor: 'lun', etiqueta: 'Lunes', corta: 'L' },
  { valor: 'mar', etiqueta: 'Martes', corta: 'M' },
  { valor: 'mie', etiqueta: 'Miércoles', corta: 'X' },
  { valor: 'jue', etiqueta: 'Jueves', corta: 'J' },
  { valor: 'vie', etiqueta: 'Viernes', corta: 'V' },
  { valor: 'sab', etiqueta: 'Sábado', corta: 'S' },
  { valor: 'dom', etiqueta: 'Domingo', corta: 'D' },
]

export const FRANJAS: { valor: FranjaHoraria; etiqueta: string }[] = [
  { valor: 'manana', etiqueta: 'Mañana' },
  { valor: 'tarde', etiqueta: 'Tarde' },
  { valor: 'noche', etiqueta: 'Noche' },
]

export const MEDIOS_PAGO: { valor: MedioPago; etiqueta: string }[] = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'nequi', etiqueta: 'Nequi' },
  { valor: 'daviplata', etiqueta: 'Daviplata' },
]

/**
 * El orden importa: de lo más solidario a lo normal. Quien marcó que no
 * puede pagar ve primero los dos primeros.
 */
export const MODOS_PRECIO: { valor: ModoPrecio; etiqueta: string; ayuda: string }[] = [
  { valor: 'gratis', etiqueta: 'Gratis', ayuda: 'No cobro por esto' },
  { valor: 'aporte', etiqueta: 'Aporte voluntario', ayuda: 'Lo que la persona pueda dar' },
  { valor: 'solidario', etiqueta: 'Precio solidario', ayuda: 'Cobro menos de lo normal' },
  { valor: 'normal', etiqueta: 'Precio normal', ayuda: 'Mi tarifa de siempre' },
]

export const UNIDADES: { valor: UnidadPrecio; etiqueta: string }[] = [
  { valor: 'hora', etiqueta: 'por hora' },
  { valor: 'trabajo', etiqueta: 'por trabajo' },
  { valor: 'dia', etiqueta: 'por día' },
  { valor: 'prenda', etiqueta: 'por prenda' },
  { valor: 'viaje', etiqueta: 'por viaje' },
  { valor: 'plato', etiqueta: 'por plato' },
  { valor: 'unidad', etiqueta: 'por unidad' },
]

export const GRUPOS: Record<GrupoOficio, string> = {
  comida: 'Comida',
  belleza: 'Belleza',
  confeccion: 'Confección y arreglos',
  transporte: 'Transporte y trasteos',
  aseo: 'Aseo',
  cuidado: 'Cuidado',
  reparacion: 'Reparaciones',
  otros: 'Otros',
}

export const TIPOS_PROVEEDOR: { valor: TipoProveedor; etiqueta: string }[] = [
  { valor: 'persona', etiqueta: 'Trabajo por mi cuenta' },
  { valor: 'microempresa', etiqueta: 'Tengo un negocio registrado' },
]

export const URGENCIAS: { valor: UrgenciaServicio; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy mismo' },
  { valor: 'esta_semana', etiqueta: 'Esta semana' },
  { valor: 'sin_prisa', etiqueta: 'Sin prisa' },
]

export const CAPACIDADES_PAGO: { valor: CapacidadPago; etiqueta: string }[] = [
  { valor: 'puedo_pagar', etiqueta: 'Puedo pagar la tarifa normal' },
  { valor: 'pago_poco', etiqueta: 'Puedo pagar algo, pero poco' },
  { valor: 'no_puedo_pagar', etiqueta: 'No puedo pagar ahora' },
]

/** Máximo de oficios por ficha. Gemelo del tope de `guardar_proveedor`. */
export const TOPE_OFICIOS = 8

const etiquetaDe = <T extends string>(
  lista: readonly { valor: T; etiqueta: string }[],
  valor: T
) => lista.find((x) => x.valor === valor)?.etiqueta ?? valor

export const etiquetaModalidad = (v: ModalidadServicio) => etiquetaDe(MODALIDADES, v)
export const etiquetaFranja = (v: FranjaHoraria) => etiquetaDe(FRANJAS, v)
export const etiquetaMedioPago = (v: MedioPago) => etiquetaDe(MEDIOS_PAGO, v)

/**
 * El precio en una línea, como se lee en la ficha.
 *
 * «Desde» siempre que haya número: el proveedor declaró un piso, no una
 * tarifa cerrada, y dar a entender lo contrario provoca justo la discusión
 * que la plataforma no puede mediar.
 */
export function precioLegible(
  modo: ModoPrecio,
  precioDesde: number | null,
  unidad: UnidadPrecio | null
): string {
  if (modo === 'gratis') return 'Gratis'
  if (modo === 'aporte') return 'Aporte voluntario'
  const prefijo = modo === 'solidario' ? 'Precio solidario' : null
  if (precioDesde == null) return prefijo ?? 'Precio a convenir'
  const monto = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(precioDesde)
  const cola = unidad ? ` ${etiquetaDe(UNIDADES, unidad)}` : ''
  return `${prefijo ? prefijo + ': ' : ''}Desde ${monto}${cola}`
}

/** «Lunes a viernes» cuando se puede, la lista suelta cuando no. */
export function diasLegibles(dias: DiaSemana[]): string | null {
  if (dias.length === 0) return null
  if (dias.length === 7) return 'Todos los días'
  const orden = DIAS.map((d) => d.valor)
  const indices = dias.map((d) => orden.indexOf(d)).sort((a, b) => a - b)
  const seguidos = indices.every((n, i) => i === 0 || n === indices[i - 1] + 1)
  if (seguidos && indices.length > 2) {
    return `${DIAS[indices[0]].etiqueta} a ${DIAS[indices[indices.length - 1]].etiqueta.toLowerCase()}`
  }
  return indices.map((i) => DIAS[i].etiqueta).join(', ')
}

/**
 * Dónde atiende, dentro del municipio.
 *
 * Pueden venir las dos —«Comuna 3 · San Fernando»— porque en Cali lo
 * natural es decir la comuna y el barrio. Con una basta; con ninguna no
 * se guarda, así que esto nunca debería devolver null en datos reales.
 */
export const zonaLegible = (nombre: string | null, texto: string | null) =>
  [nombre, texto].filter(Boolean).join(' · ') || null
