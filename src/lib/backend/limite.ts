import 'server-only'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/backend/servicio'

export interface ConfigLimite {
  /** Sufijo que separa cubos por ruta, p. ej. 'crear' o 'responder'. */
  nombre: string
  /** Máximo de solicitudes permitidas dentro de la ventana. */
  max: number
  /** Tamaño de la ventana fija, en segundos. */
  ventanaSegundos: number
}

/**
 * Consume un cupo de la ventana y dice si el cliente puede continuar.
 * `limitar` recibe la real por defecto; las pruebas le pasan una simulada
 * para no tocar la base.
 */
export type Consumidor = (
  clave: string,
  max: number,
  ventanaSegundos: number,
) => Promise<boolean>

/** IP del cliente tras el proxy de Vercel; '' si no hay cabecera. */
export function clienteIp(request: Request): string {
  const cabecera = request.headers.get('x-forwarded-for')
  if (!cabecera) return ''
  // El primer salto es el cliente; los siguientes son proxies.
  return cabecera.split(',')[0]?.trim() ?? ''
}

// La implementación real: llama a `consumir_limite` con el rol de servicio.
// La IP viaja en el cuerpo de la RPC, nunca en URL ni log (regla 6).
async function consumirReal(
  clave: string,
  max: number,
  ventanaSegundos: number,
): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('consumir_limite', {
    p_clave: clave,
    p_max: max,
    p_ventana_seg: ventanaSegundos,
  })
  if (error) throw new Error(error.message)
  return data === true
}

/**
 * Devuelve una respuesta 429 si el cliente superó el límite, o `null` si
 * puede continuar.
 *
 * FALLA ABIERTO: si `consumir_limite` revienta (DB caída, blip de red), se
 * devuelve `null` y la petición continúa — igual que los bloques push
 * best-effort del resto del código. Un límite de tasa no debe tumbar toda
 * la escritura del sitio cuando la base parpadea.
 *
 * El tercer parámetro es una costura para las pruebas; las rutas llaman
 * `limitar(request, config)` y usan la implementación real.
 */
export async function limitar(
  request: Request,
  config: ConfigLimite,
  consumir: Consumidor = consumirReal,
): Promise<NextResponse | null> {
  const clave = `${config.nombre}:${clienteIp(request)}`
  try {
    const permitido = await consumir(clave, config.max, config.ventanaSegundos)
    if (permitido) return null
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.' },
      { status: 429 },
    )
  } catch {
    // Falla abierto a propósito. No se loggea nada (regla 6).
    return null
  }
}
