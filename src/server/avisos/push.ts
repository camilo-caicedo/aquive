import { eq, inArray } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { pushAvisos } from '@/db/esquema'
import { configurarWebPush, enviarPush } from '@/lib/push-vapid'

/**
 * Avisarle a UNA persona.
 *
 * ⚠ Esto faltaba, y su falta rompía la cadena entera. Había con qué
 * suscribirse —la tabla cuelga de `perfil_id` y el interruptor de
 * `/perfil/avisos` la llena— y no había quién enviara: el único envío que
 * existía leía `push_suscripciones`, una tabla que solo llenaba un componente
 * sin importadores. Mientras tanto `/perfil/avisos` decía que tres tipos de
 * aviso «Llegan».
 *
 * ⚠ La tabla se llamaba `push_ofertadores` y no era de insumos: es la única
 * de suscripciones push de toda la aplicación. Se renombró a `push_avisos`
 * con el ADR 0014, que es lo que dice.
 *
 * ⚠ Del payload no sale ni un dato personal. Ni nombres, ni teléfonos, ni el
 * texto del mensaje: un aviso se ve en la pantalla bloqueada de un teléfono
 * que puede estar en la mano de otra persona. Lo que va es qué pasó y a
 * dónde ir, y el resto se lee dentro, con sesión.
 *
 * Es best-effort de principio a fin: lo que provocó el aviso ya está
 * guardado, y un fallo aquí no puede tumbarlo. Por eso nada de esto lanza.
 */
export async function avisar(
  db: BaseDeDatos,
  perfilId: string,
  aviso: { cuerpo: string; url: string; tag: string },
) {
  try {
    const destinos = await db
      .select({
        id: pushAvisos.id,
        endpoint: pushAvisos.endpoint,
        p256dh: pushAvisos.p256Dh,
        auth_key: pushAvisos.authKey,
      })
      .from(pushAvisos)
      .where(eq(pushAvisos.perfilId, perfilId))

    if (destinos.length === 0) return

    configurarWebPush()

    const payload = JSON.stringify({
      body: aviso.cuerpo,
      tag: aviso.tag,
      url: aviso.url,
    })

    const muertas: string[] = []
    await Promise.all(
      destinos.map(async (d) => {
        if ((await enviarPush(d, payload)) === 'muerta') muertas.push(d.id)
      }),
    )

    // Una suscripción que el navegador ya botó se borra, no se reintenta:
    // dejarla es pagar un envío fallido cada vez, para siempre.
    if (muertas.length > 0) {
      await db.delete(pushAvisos).where(inArray(pushAvisos.id, muertas))
    }
  } catch {
    // Silencioso a propósito, y sin loggear nada (regla de producto 9).
  }
}
