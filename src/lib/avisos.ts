import { createClient } from '@/lib/supabase/client'

// base64url → Uint8Array, formato que exige pushManager.subscribe
function claveAplicacion(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const normal = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(normal)
  const salida = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) salida[i] = binario.charCodeAt(i)
  return salida
}

export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export const enPantallaDeInicio = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true

export const soportaAvisos = () =>
  'serviceWorker' in navigator && 'PushManager' in window

/** Si este dispositivo ya está suscrito. No dice nada de otros dispositivos. */
export async function avisosActivosAqui(): Promise<boolean> {
  if (!soportaAvisos() || Notification.permission !== 'granted') return false
  try {
    const registro = await navigator.serviceWorker.getRegistration()
    return !!(await registro?.pushManager.getSubscription())
  } catch {
    return false
  }
}

export type ResultadoAvisos = 'activado' | 'ios' | 'sin-permiso' | 'error'

export async function activarAvisos(): Promise<ResultadoAvisos> {
  if (!soportaAvisos()) return esIOS() ? 'ios' : 'error'
  // En iOS el push solo existe si el sitio está en la pantalla de inicio.
  if (esIOS() && !enPantallaDeInicio()) return 'ios'

  try {
    if ((await Notification.requestPermission()) !== 'granted') return 'sin-permiso'

    const registro = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const suscripcion =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveAplicacion(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      }))

    const json = suscripcion.toJSON()
    const { error } = await createClient().rpc('guardar_push_ofertador', {
      p_endpoint: suscripcion.endpoint,
      p_p256dh: json.keys?.p256dh ?? '',
      p_auth: json.keys?.auth ?? '',
    })
    return error ? 'error' : 'activado'
  } catch {
    return 'error'
  }
}

/** Apaga los avisos solo en este dispositivo. */
export async function desactivarAvisos(): Promise<boolean> {
  try {
    const registro = await navigator.serviceWorker.getRegistration()
    const suscripcion = await registro?.pushManager.getSubscription()

    if (suscripcion) {
      await createClient().rpc('quitar_push_ofertador', {
        p_endpoint: suscripcion.endpoint,
      })
      await suscripcion.unsubscribe()
    }
    return true
  } catch {
    return false
  }
}
