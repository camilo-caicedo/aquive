import Link from 'next/link'
import { MapPin, MessageSquare, HeartHandshake } from 'lucide-react'
import { categoria, horasParaVencer } from '@/lib/catalogo'
import type { MiRespuesta } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

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
      <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-base text-muted-foreground">
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
          <li key={r.id} className="rounded-2xl bg-card p-4 shadow-sm">
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

            {r.flujo === 'acompanado' && r.tiene_hilo && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
                <HeartHandshake className="size-4 shrink-0" aria-hidden="true" />
                Una fundación acompaña esta entrega
              </p>
            )}

            <p className="mt-2 text-base text-muted-foreground">{r.mensaje}</p>

            {/* El caso que se nos escapó dos veces probando: alguien
                responde, y DESPUÉS quien pidió activa el acompañamiento.
                Su respuesta se conserva —§7— pero la coordinación ya pasó
                adentro, y nadie se lo había dicho. */}
            {r.flujo === 'acompanado' && !r.tiene_hilo && (
              <Alert className="mt-3">
                <AlertDescription>
                  Después de que respondiste, esta persona pidió que una
                  fundación acompañe la entrega. Ahora se coordina aquí
                  dentro, con los tres en la misma conversación.
                </AlertDescription>
              </Alert>
            )}

            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
              {r.num_respuestas === 1
                ? 'Eres la única persona que ha respondido'
                : `Otras ${r.num_respuestas - 1} personas también respondieron`}
            </p>

            {/* No hay enlace a la pantalla de quien pidió —solo ella tiene
                el token— pero sí a la solicitud, que es donde se puede
                volver a mirar, y donde se abre la conversación. */}
            {r.tiene_hilo ? (
              <Button
                variant="outline"
                className="mt-3 w-full"
                nativeButton={false}
                render={<Link href="/aliado" />}
              >
                <MessageSquare className="size-5" aria-hidden="true" />
                Ver la conversación
              </Button>
            ) : (
              <Button
                variant={r.flujo === 'acompanado' ? 'default' : 'outline'}
                className="mt-3 w-full"
                nativeButton={false}
                render={<Link href={`/responder/${r.codigo}`} />}
              >
                {r.flujo === 'acompanado' ? 'Abrir la conversación' : 'Ver la solicitud'}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
