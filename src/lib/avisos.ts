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

/**
 * Todo lo que hay que hacer en el navegador para poder recibir avisos:
 * pedir el permiso, registrar el service worker y suscribirse.
 *
 * ⚠ `Notification.requestPermission()` EXIGE un gesto de la persona. Llamar
 * a esto fuera de un manejador de clic no adelanta nada: el navegador lo
 * ignora, y donde no lo ignore el aviso sale sin contexto y quien lo vea
 * dirá que no. Un «Bloquear» es permanente para ese navegador — no se
 * puede volver a preguntar nunca. Por eso los avisos se ofrecen con un
 * botón grande y en el momento oportuno, no se disparan solos.
 *
 * Devuelve la suscripción para que quien llama la guarde. Desde el ADR 0006
 * hay un solo sitio donde guardarla —`push_avisos`, por cuenta—: la otra
 * mitad colgaba del token de una solicitud, y esos tokens ya no existen.
 */
async function suscribirEsteDispositivo(): Promise<
  { ok: true; suscripcion: PushSubscription } | { ok: false; motivo: ResultadoAvisos }
> {
  if (!soportaAvisos()) return { ok: false, motivo: esIOS() ? 'ios' : 'error' }
  // En iOS el push solo existe si el sitio está en la pantalla de inicio.
  if (esIOS() && !enPantallaDeInicio()) return { ok: false, motivo: 'ios' }

  try {
    if ((await Notification.requestPermission()) !== 'granted') {
      return { ok: false, motivo: 'sin-permiso' }
    }

    const registro = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const suscripcion =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveAplicacion(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      }))

    return { ok: true, suscripcion }
  } catch {
    return { ok: false, motivo: 'error' }
  }
}

/**
 * Encender los avisos en este dispositivo.
 *
 * La suscripción cuelga de la cuenta, no de una solicitud: así sirve para
 * todo lo que le pase a esa persona —un mensaje de chat, una respuesta a lo
 * que pidió, una solicitud nueva en sus municipios— y sobrevive a que la
 * solicitud que la originó se borre.
 */
export async function activarAvisos(): Promise<ResultadoAvisos> {
  const r = await suscribirEsteDispositivo()
  if (!r.ok) return r.motivo

  const json = r.suscripcion.toJSON()
  const { error } = await createClient().rpc('guardar_push', {
    p_endpoint: r.suscripcion.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
  })
  return error ? 'error' : 'activado'
}

/** Apaga los avisos solo en este dispositivo. */
export async function desactivarAvisos(): Promise<boolean> {
  try {
    const registro = await navigator.serviceWorker.getRegistration()
    const suscripcion = await registro?.pushManager.getSubscription()

    if (suscripcion) {
      await createClient().rpc('quitar_push', {
        p_endpoint: suscripcion.endpoint,
      })
      await suscripcion.unsubscribe()
    }
    return true
  } catch {
    return false
  }
}
