import Link from 'next/link'
import { MessageSquare } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'

export const metadata = { title: 'Mensajes' }

/**
 * La bandeja única. Todos los hilos de una persona, en un sitio.
 *
 * ⚠ Antes juntaba dos cosas: los pedidos de servicio y las entregas
 * acompañadas de una fundación. Las segundas se fueron con el ADR 0007, así
 * que la bandeja quedó con una sola clase de hilo. El nombre en plural se
 * queda igual: sigue siendo la lista de con quién estás hablando.
 *
 * Desde el ADR 0006 los dos lados tienen cuenta, así que aquí aparecen
 * los hilos de quien pide Y los de quien presta. Antes los primeros no
 * podían salir: quien pedía no tenía cuenta y no había forma de saber
 * cuáles eran suyos.
 */
export default async function MensajesPage() {
  const hilosServicio = await servidor.chat.bandeja()
  const vacio = hilosServicio.length === 0

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

        </>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Los hilos se borran con el pedido o la solicitud que los abrió. No hay
        archivo de conversaciones.
      </p>
    </main>
  )
}
