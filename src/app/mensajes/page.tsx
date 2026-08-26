import Link from 'next/link'
import { MessageSquare } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { createClient } from '@/lib/supabase/server'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { FilaBandeja } from '@/components/fila-bandeja'
import type { HiloResumen } from '@/lib/types'

export const metadata = { title: 'Mensajes' }

/**
 * La bandeja única. Todos los hilos de una persona, en un sitio.
 *
 * Antes había dos destinos —`/mensajes` para los pedidos de servicio y
 * `/coordinacion` para las entregas acompañadas— y en la barra inferior se
 * veían como dos celdas llamadas «Mensajes». Dos puertas al mismo cuarto:
 * quien tenía las dos no sabía cuál abrir, y ninguna de las dos contenía
 * todos sus mensajes.
 *
 * Son conversaciones distintas por dentro —una es bilateral y filtra
 * contactos, la otra es de tres con una fundación delante— pero para quien
 * las lee son lo mismo: gente con la que está hablando. Se juntan aquí y se
 * distinguen con un antetítulo, que es todo lo que hace falta.
 *
 * ⚠ Lo que NO aparece: los hilos de quien PIDIÓ un servicio. No tiene cuenta
 * —esa es la promesa— así que no hay forma de saber cuáles son suyos. Viven
 * en el enlace de su solicitud, y la pantalla lo dice en vez de enseñar una
 * bandeja vacía que se leería como «no tienes mensajes».
 */
export default async function MensajesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [hilosServicio, acompanados] = await Promise.all([
    servidor.chat.bandeja(),
    // Todavía por RPC: el flujo acompañado no ha pasado al contrato. Es lo
    // único de esta pantalla que sigue del lado viejo.
    user
      ? supabase.rpc('mis_hilos').then((r) => (r.data as unknown as HiloResumen[]) ?? [])
      : Promise.resolve([] as HiloResumen[]),
  ])

  const vacio = hilosServicio.length === 0 && acompanados.length === 0

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Mensajes" />

      {vacio ? (
        <div className="shadow-canto mt-4 rounded-2xl bg-card p-6">
          <MessageSquare className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-base">
            Aquí aparecen los hilos de los pedidos que respondiste y las
            entregas que estés coordinando.
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            ¿Pediste tú un servicio? Tus hilos están en el enlace de tu
            solicitud, no aquí: publicaste sin cuenta, así que no tenemos forma
            de saber cuáles son tuyos. Guarda ese enlace.
          </p>
          <Link
            href="/mis-solicitudes"
            className="text-enlace mt-3 inline-block text-base underline underline-offset-4"
          >
            Ver mis solicitudes guardadas
          </Link>
        </div>
      ) : (
        <>
          {hilosServicio.length > 0 && (
            <section className="mt-4">
              <h2 className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
                Pedidos de servicio
              </h2>
              <ul className="mt-2 space-y-3">
                {hilosServicio.map((h) => (
                  <li key={h.respuesta_id}>
                    <Link
                      href={`/servicios/chat/${h.respuesta_id}`}
                      className="shadow-canto block rounded-2xl bg-card p-4"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-heading text-base">{h.con}</span>
                        <span className="text-sm text-muted-foreground">
                          {h.mensajes} {h.mensajes === 1 ? 'mensaje' : 'mensajes'}
                        </span>
                      </div>
                      {h.oficio && (
                        <p className="font-heading mt-0.5 text-xs tracking-[0.085em] text-muted-foreground uppercase">
                          {h.oficio}
                        </p>
                      )}
                      {h.ultimo && (
                        <p className="mt-2 line-clamp-2 text-base text-muted-foreground">
                          {h.ultimo}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {acompanados.length > 0 && (
            <section className="mt-8">
              <h2 className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
                Entregas acompañadas
              </h2>
              <p className="mt-1 text-base text-muted-foreground">
                Con una fundación delante. Los tres están en el hilo.
              </p>
              <ul className="mt-2 space-y-3">
                {acompanados.map((h) => (
                  <FilaBandeja
                    key={h.id}
                    href={`/aliado/conversacion/${h.id}`}
                    codigo={h.codigo}
                    lugar={[h.barrio, h.municipio].filter(Boolean).join(' · ')}
                    quien={
                      h.directa
                        ? 'La fundación entrega de su bodega'
                        : [h.ofertador, h.aliado].filter(Boolean).join(' · ') ||
                          'Sin asignar'
                    }
                    estado={h.estado}
                    ultimo={
                      h.mensajes_total === 1
                        ? '1 mensaje'
                        : `${h.mensajes_total} mensajes`
                    }
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Los hilos se borran con el pedido o la solicitud que los abrió. No hay
        archivo de conversaciones.
      </p>
    </main>
  )
}
