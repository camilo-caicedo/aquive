import { headers } from 'next/headers'

/**
 * La URL base del sitio, tal como la ve quien está mirando.
 *
 * Existe porque un componente de cliente no puede calcularla sin romper la
 * hidratación: en el servidor no hay `window`, así que el HTML sale con una
 * cosa y el navegador la reemplaza por otra. Se calcula aquí, en el
 * servidor, y baja como propiedad.
 *
 * Mismo cálculo que hacía a mano `/solicitud/[token]` para armar el enlace
 * de la solicitud.
 */
export async function origenDelSitio() {
  const cabeceras = await headers()
  const host = cabeceras.get('host') ?? 'localhost:3000'
  const protocolo =
    cabeceras.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${protocolo}://${host}`
}
