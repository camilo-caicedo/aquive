import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'

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
 * Avisa a quienes ofrecen ayuda en ese municipio que hay una solicitud
 * nueva.
 *
 * El aviso solo lleva municipio y categoría: son datos que ya están en el
 * tablero público. Nunca el código, el barrio ni la nota — nada que
 * permita acercarse a quién pidió.
 *
 * Solo se notifica a quien tenga ese municipio entre los suyos: enterarse
 * de solicitudes del otro lado del país no ayuda a nadie y haría que la
 * gente apague los avisos.
 *
 * No se filtra por `tipo`. Antes se pedía `tipo = 'ofertador'`, y eso hacía
 * que un servidor que activaba los avisos en su perfil no recibiera nunca
 * ninguno: la pantalla se los ofrecía y el servidor los descartaba en
 * silencio. Lo que decide aquí es tener una suscripción en
 * `push_ofertadores`, que solo existe si la persona la activó a propósito.
 */
export async function notificarOfertadores(
  municipioCodigo: string,
  municipioNombre: string,
  categoriaEtiqueta: string
) {
  const supabase = createServiceClient()

  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id')
    .eq('suspendido', false)
    .contains('municipios', [municipioCodigo])

  if (!perfiles || perfiles.length === 0) return

  const { data: suscripciones } = await supabase
    .from('push_ofertadores')
    .select('id, endpoint, p256dh, auth_key')
    .in(
      'perfil_id',
      perfiles.map((p) => p.id)
    )

  if (!suscripciones || suscripciones.length === 0) return

  configurar()

  const payload = JSON.stringify({
    body: `Alguien necesita ${categoriaEtiqueta.toLowerCase()} en ${municipioNombre}`,
    tag: `solicitud-${municipioCodigo}`,
    url: 'https://aquive.co/?municipio=' + municipioCodigo,
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
        const codigo = (error as ErrorWebPush).statusCode
        if (codigo === 404 || codigo === 410) muertas.push(s.id)
      }
    })
  )

  if (muertas.length > 0) {
    await supabase.from('push_ofertadores').delete().in('id', muertas)
  }
}
