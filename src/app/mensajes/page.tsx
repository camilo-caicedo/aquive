import Link from 'next/link'
import { MessageSquare } from 'lucide-react'

import type { Origen } from '@/contrato/chat'
import { servidor } from '@/orpc/local'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'

export const metadata = { title: 'Mensajes' }

/** De dónde salió el hilo. Va como palabra, nunca como color solo. */
const DE: Record<Origen['tipo'], string> = {
  servicio: 'Servicio',
  insumo: 'Insumo',
  producto: 'Producto',
  muro: 'Comunidad',
  ficha: 'Ficha',
}

/**
 * La bandeja única. Todos los hilos de una persona, en un sitio.
 *
 * Una sola lista y no una sección por módulo: agrupar por origen sería un
 * segundo nivel de navegación —regla de interfaz 3— para responder la misma
 * pregunta que ya responde el orden por fecha, que es «quién me escribió de
 * último». De qué va cada hilo lo dice su etiqueta.
 *
 * Los dos lados aparecen aquí, y desde el ADR 0006 eso vale para todos:
 * antes quien pedía no tenía cuenta y sus hilos no se podían listar.
 */
export default async function MensajesPage() {
  const hilos = await servidor.chat.bandeja()

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Mensajes" />

      {hilos.length === 0 ? (
        <div className="shadow-canto mt-4 rounded-2xl bg-card p-6">
          <MessageSquare className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-base">
            Aquí aparecen tus conversaciones: los pedidos de servicio, las
            preguntas por un producto y lo que se acuerde en la comunidad.
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            Un hilo empieza cuando alguien escribe. Busca lo que necesitas y
            usa el botón de escribir.
          </p>
          <Link
            href="/categorias"
            className="text-enlace mt-3 inline-block text-base underline underline-offset-4"
          >
            Ver categorías
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {hilos.map((h) => (
            <li key={`${h.origen.tipo}-${h.origen.id}`}>
              <Link
                href={`/chat/${h.origen.tipo}/${h.origen.id}`}
                className="shadow-canto block rounded-2xl bg-card p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`font-heading text-base ${h.sin_leer ? 'font-bold' : ''}`}>
                    {h.con}
                  </span>
                  {/* El estado no depende solo del color ni solo del grosor:
                      lleva su palabra. El punto de la barra dice que hay
                      algo; esta línea dice cuál. */}
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {h.sin_leer ? (
                      <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 font-semibold">
                        Sin leer
                      </span>
                    ) : (
                      <>
                        {h.mensajes} {h.mensajes === 1 ? 'mensaje' : 'mensajes'}
                      </>
                    )}
                  </span>
                </div>
                <p className="font-heading mt-0.5 text-xs tracking-[0.085em] text-muted-foreground uppercase">
                  {DE[h.origen.tipo]}
                  {h.asunto && ` · ${h.asunto}`}
                </p>
                {h.ultimo && (
                  <p className="mt-2 line-clamp-2 text-base text-muted-foreground">
                    {h.ultimo}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Los hilos se borran con lo que los abrió. No hay archivo de
        conversaciones.
      </p>
    </main>
  )
}
