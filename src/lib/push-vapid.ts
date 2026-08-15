import webpush from 'web-push'

let configurado = false

/** Las llaves se cargan una vez por instancia, no por envío. */
export function configurarWebPush() {
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
 * Manda uno y dice si la suscripción está muerta.
 *
 * 404 y 410 significan que el navegador ya botó la suscripción: se borra,
 * no se reintenta. Cualquier otro error se traga —el aviso es un extra, y
 * lo que se estaba haciendo ya quedó guardado—.
 */
export async function enviarPush(
  destino: { endpoint: string; p256dh: string; auth_key: string },
  payload: string
): Promise<'ok' | 'muerta'> {
  try {
    await webpush.sendNotification(
      { endpoint: destino.endpoint, keys: { p256dh: destino.p256dh, auth: destino.auth_key } },
      payload
    )
    return 'ok'
  } catch (error) {
    const codigo = (error as ErrorWebPush).statusCode
    return codigo === 404 || codigo === 410 ? 'muerta' : 'ok'
  }
}
