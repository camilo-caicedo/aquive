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
  categoriaEtiqueta: string,
  itemIds: string[] = []
) {
  const supabase = createServiceClient()

  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id')
    .eq('suspendido', false)
    .contains('municipios', [municipioCodigo])

  if (!perfiles || perfiles.length === 0) return

  const ids = perfiles.map((p) => p.id)

  // Quien nos contó qué tiene recibe aviso solo si la solicitud pide algo
  // de su lista. Quien no llenó inventario sigue recibiendo todo lo de sus
  // municipios, como hasta ahora: el inventario es opcional y no puede
  // convertirse en el precio de enterarse.
  //
  // Es la mitad que faltaba del cruce: hasta aquí uno tenía que entrar a
  // mirar el tablero para saber que alguien necesitaba lo suyo.
  const { data: inventarios } = await supabase
    .from('ofrecimientos')
    .select('perfil_id, item_id')
    .in('perfil_id', ids)
    .eq('disponible', true)

  const tieneInventario = new Set((inventarios ?? []).map((o) => o.perfil_id))
  const pedido = new Set(itemIds)
  const calzan = new Set(
    (inventarios ?? [])
      .filter((o) => o.item_id !== null && pedido.has(o.item_id))
      .map((o) => o.perfil_id)
  )

  const destinatarios = ids.filter((id) => !tieneInventario.has(id) || calzan.has(id))
  if (destinatarios.length === 0) return

  const { data: suscripciones } = await supabase
    .from('push_ofertadores')
    .select('id, perfil_id, endpoint, p256dh, auth_key')
    .in('perfil_id', destinatarios)

  if (!suscripciones || suscripciones.length === 0) return

  configurar()

  // Dos mensajes, ninguno con nada que permita acercarse a quién pidió: el
  // municipio y la categoría ya están en el tablero público.
  const generico = JSON.stringify({
    body: `Alguien necesita ${categoriaEtiqueta.toLowerCase()} en ${municipioNombre}`,
    tag: `solicitud-${municipioCodigo}`,
    url: 'https://aquive.co/?municipio=' + municipioCodigo,
  })
  const conCoincidencia = JSON.stringify({
    body: `Alguien necesita algo que tienes en ${municipioNombre}`,
    tag: `solicitud-${municipioCodigo}`,
    url: 'https://aquive.co/?municipio=' + municipioCodigo,
  })

  const muertas: string[] = []

  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          calzan.has(s.perfil_id) ? conCoincidencia : generico
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
