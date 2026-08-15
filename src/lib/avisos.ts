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
 * Devuelve la suscripción para que cada lado la guarde donde le toca:
 * quien ofrece en `push_ofertadores`, por su cuenta; quien pide en
 * `push_suscripciones`, por el token de su solicitud.
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

/** Para quien OFRECE: la suscripción cuelga de su perfil. */
export async function activarAvisos(): Promise<ResultadoAvisos> {
  const r = await suscribirEsteDispositivo()
  if (!r.ok) return r.motivo

  const json = r.suscripcion.toJSON()
  const { error } = await createClient().rpc('guardar_push_ofertador', {
    p_endpoint: r.suscripcion.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
  })
  return error ? 'error' : 'activado'
}

/**
 * Para quien PIDE: la suscripción cuelga de la solicitud y muere con ella.
 *
 * Va por `/api/push` y no por RPC porque quien pide no tiene cuenta: lo
 * único que lo identifica es el token, y ese token viaja en el cuerpo,
 * nunca en la URL (regla 6).
 */
export async function activarAvisosDeSolicitud(token: string): Promise<ResultadoAvisos> {
  const r = await suscribirEsteDispositivo()
  if (!r.ok) return r.motivo

  const json = r.suscripcion.toJSON()
  try {
    const respuesta = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        endpoint: r.suscripcion.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
      }),
    })
    return respuesta.ok ? 'activado' : 'error'
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
