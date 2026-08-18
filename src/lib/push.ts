import webpush from 'web-push'
import { createServiceClient } from '@/lib/backend/servicio'

let configurado = false

function configurar() {
  if (configurado) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:contacto@aquive.co',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  configurado = true
}

interface ErrorWebPush {
  statusCode?: number
}

/**
 * Avisa al solicitante que alguien respondió.
 *
 * El cuerpo lleva solo el código: nunca el mensaje del ofertador ni su
 * contacto. Aunque el payload va cifrado extremo a extremo, la regla es
 * no meter en la notificación nada que no haga falta.
 */
export async function notificarRespuesta(solicitudId: string, codigo: string, url: string) {
  const supabase = createServiceClient()

  const { data: suscripciones } = await supabase
    .from('push_suscripciones')
    .select('id, endpoint, p256dh, auth_key')
    .eq('solicitud_id', solicitudId)

  if (!suscripciones || suscripciones.length === 0) return

  configurar()

  const payload = JSON.stringify({
    body: `Alguien respondió a tu solicitud ${codigo}`,
    tag: `respuesta-${codigo}`,
    url,
  })

  const muertas: string[] = []

  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          payload
        )
      } catch (error) {
        const codigoHttp = (error as ErrorWebPush).statusCode
        // 404/410: el navegador ya botó la suscripción. Se borra, no se reintenta.
        if (codigoHttp === 404 || codigoHttp === 410) muertas.push(s.id)
      }
    })
  )

  if (muertas.length > 0) {
    await supabase.from('push_suscripciones').delete().in('id', muertas)
  }
}
