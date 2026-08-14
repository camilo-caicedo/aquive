import Link from 'next/link'
import { MapPin, MessageSquare, HeartHandshake } from 'lucide-react'
import { categoria, horasParaVencer } from '@/lib/catalogo'
import type { MiRespuesta } from '@/lib/types'
import { Button } from '@/components/ui/button'

/**
 * Lo que respondió quien ofrece ayuda.
 *
 * Faltaba desde el principio y se nota al usar la plataforma: quien pide
 * tiene «Mis solicitudes» y quien ofrece escribía un mensaje que después
 * no podía volver a encontrar.
 *
 * Solo salen las que siguen vivas. Las que ya no están se borraron con su
 * solicitud, y eso se dice: es la promesa de borrado funcionando, no un
 * hueco de la pantalla.
 */
export function MisRespuestas({ respuestas }: { respuestas: MiRespuesta[] }) {
  if (respuestas.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-border p-6 text-center text-base text-muted-foreground">
        Todavía no has respondido ninguna solicitud. Las que respondas
        aparecen aquí mientras sigan abiertas.
      </p>
    )
  }

  return (
    <ul className="mt-3 space-y-3">
      {respuestas.map((r) => {
        const horas = Math.max(0, Math.round(horasParaVencer(r.expira_at)))
        return (
          <li key={r.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-lg font-bold">{r.codigo}</span>
              <span className="text-sm text-muted-foreground">
                {horas > 0 ? `Se borra en ${horas} h` : 'Está por borrarse'}
              </span>
            </div>

            <p className="mt-1 flex items-center gap-1.5 text-base">
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {r.municipio} — {r.barrio} · {categoria(r.categoria).etiqueta}
            </p>

            {r.flujo === 'acompanado' && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ok">
                <HeartHandshake className="size-4 shrink-0" aria-hidden="true" />
                Una fundación acompaña esta entrega
              </p>
            )}

            <p className="mt-2 text-base text-muted-foreground">{r.mensaje}</p>

            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
              {r.num_respuestas === 1
                ? 'Eres la única persona que ha respondido'
                : `Otras ${r.num_respuestas - 1} personas también respondieron`}
            </p>

            {/* No hay enlace a la solicitud de quien pidió —solo ella tiene
                el token— pero sí al tablero, que es donde se puede volver a
                mirar si sigue abierta. */}
            <Button
              variant="outline"
              className="mt-3 w-full"
              nativeButton={false}
              render={<Link href={`/responder/${r.codigo}`} />}
            >
              Ver la solicitud
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
