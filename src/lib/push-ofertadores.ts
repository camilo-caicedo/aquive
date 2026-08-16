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

  // Quién recibe se decide en la base, en una sola consulta, y no trayendo
  // los inventarios para cruzarlos aquí. Dos razones, las dos descubiertas
  // en revisión y las dos silenciosas:
  //
  //   · PostgREST corta en 1000 filas —el mismo tope que obligó a crear
  //     `listar_municipios`— y la llave de servicio no exime. Con 150
  //     perfiles de 10 ítems, la lista llegaba truncada y sin orden, y
  //     alguien con exactamente lo que se pedía podía perderse el aviso.
  //   · `.in('perfil_id', [...])` mete todos los uuid en el query string de
  //     un GET: con unos cientos de perfiles la URL revienta, la respuesta
  //     vuelve nula y el filtro desaparece entero.
  //
  // Y de paso deja de mandar uuid de personas por la URL (regla 6).
  const { data: destinatarios } = await supabase.rpc('destinatarios_aviso', {
    p_municipio: municipioCodigo,
    p_item_ids: itemIds,
  })

  if (!destinatarios || destinatarios.length === 0) return

  configurar()

  // Dos mensajes, ninguno con nada que permita acercarse a quién pidió: el
  // municipio y la categoría ya están en el tablero público. El de
  // coincidencia no dice cuál ítem calzó.
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
    destinatarios.map(async (d) => {
      try {
        await webpush.sendNotification(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth_key } },
          d.calza ? conCoincidencia : generico
        )
      } catch (error) {
        const codigo = (error as ErrorWebPush).statusCode
        if (codigo === 404 || codigo === 410) muertas.push(d.suscripcion_id)
      }
    })
  )

  if (muertas.length > 0) {
    await supabase.from('push_ofertadores').delete().in('id', muertas)
  }
}
