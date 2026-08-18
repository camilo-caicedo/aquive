import { createServiceClient } from '@/lib/backend/servicio'
import { configurarWebPush, enviarPush } from '@/lib/push-vapid'

/**
 * Avisa a los otros dos de un hilo que pasó algo.
 *
 * El cuerpo lleva SOLO el código de la solicitud, nunca el texto del
 * mensaje. En pantalla bloqueada una notificación se lee sin desbloquear,
 * y lo que se coordina aquí incluye direcciones de acopio y horas de
 * encuentro. Aunque el payload va cifrado extremo a extremo, la regla es
 * no meter en el aviso nada que no haga falta.
 *
 * Best-effort de principio a fin: si esto falla entero, el mensaje ya
 * quedó guardado y sale en el panel de avisos al volver.
 */
export async function notificarConversacion(
  conversacionId: string,
  texto: (codigo: string) => string,
  origen: string,
  excluir: { perfilId?: string; solicitante?: boolean } = {}
) {
  const supabase = createServiceClient()

  const { data: destinos } = await supabase.rpc('destinatarios_conversacion', {
    p_conversacion_id: conversacionId,
    p_excluir_perfil: excluir.perfilId ?? undefined,
    p_excluir_solicitante: excluir.solicitante ?? false,
  })

  if (!destinos || destinos.length === 0) return

  configurarWebPush()

  const muertas = { solicitante: [] as string[], perfil: [] as string[] }

  await Promise.all(
    destinos.map(async (d) => {
      const payload = JSON.stringify({
        body: texto(d.codigo),
        // Mismo `tag` por hilo: tres mensajes seguidos reemplazan la
        // notificación anterior en vez de apilar tres.
        tag: `hilo-${conversacionId}`,
        // Cada quien a su puerta. Quien tiene cuenta llega a su hilo por
        // /aliado; a quien pidió ayuda no se le puede enlazar su
        // solicitud, porque el servidor solo guarda el hash de su token,
        // así que va a la lista que guarda su propio navegador.
        url: d.de_solicitante ? `${origen}/mis-solicitudes` : `${origen}/aliado`,
      })
      if ((await enviarPush(d, payload)) === 'muerta') {
        muertas[d.de_solicitante ? 'solicitante' : 'perfil'].push(d.suscripcion_id)
      }
    })
  )

  // Cada una en su tabla: la de quien pide cuelga de la solicitud, la de
  // quien ofrece o coordina cuelga del perfil.
  if (muertas.solicitante.length > 0) {
    await supabase.from('push_suscripciones').delete().in('id', muertas.solicitante)
  }
  if (muertas.perfil.length > 0) {
    await supabase.from('push_ofertadores').delete().in('id', muertas.perfil)
  }
}

/**
 * Avisa a quienes ya habían ofrecido ayuda que ahora hay una fundación
 * coordinando esa solicitud.
 *
 * Quien respondió hace dos días no vuelve solo a mirar, y este es
 * justamente el momento en que su ofrecimiento puede convertirse en algo.
 */
export async function notificarAcompanamiento(
  solicitudId: string,
  codigo: string,
  url: string
) {
  const supabase = createServiceClient()

  const { data: destinos } = await supabase.rpc('destinatarios_respondieron', {
    p_solicitud_id: solicitudId,
  })

  if (!destinos || destinos.length === 0) return

  configurarWebPush()

  const payload = JSON.stringify({
    body: `Ahora una fundación acompaña ${codigo}, donde ofreciste ayuda`,
    tag: `acompanamiento-${codigo}`,
    url,
  })

  const muertas: string[] = []
  await Promise.all(
    destinos.map(async (d) => {
      if ((await enviarPush(d, payload)) === 'muerta') muertas.push(d.suscripcion_id)
    })
  )

  if (muertas.length > 0) {
    await supabase.from('push_ofertadores').delete().in('id', muertas)
  }
}
