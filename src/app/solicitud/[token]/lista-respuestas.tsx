import { BadgeCheck, TriangleAlert, Inbox } from 'lucide-react'
import type { SolicitudConRespuestas } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { BotonReportar } from '@/components/boton-reportar'

type Respuesta = SolicitudConRespuestas['respuestas'][number]

export function ListaRespuestas({ respuestas }: { respuestas: Respuesta[] }) {
  if (respuestas.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-border p-6 text-center">
        <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-base text-muted-foreground">
          Todavía nadie responde. Guarda tu enlace y vuelve más tarde.
        </p>
      </div>
    )
  }

  return (
    <ul className="mt-3 space-y-3">
      {respuestas.map((r) => (
        <li key={r.id} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{r.nombre}</span>
            {r.tipo === 'servidor' &&
              (r.verificado ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-sm font-medium text-green-900">
                  <BadgeCheck className="size-4" aria-hidden="true" />
                  Matrícula verificada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-sm font-medium text-amber-900">
                  <TriangleAlert className="size-4" aria-hidden="true" />
                  Sin verificar
                </span>
              ))}
          </div>

          {r.profesion && <p className="mt-1 text-base text-muted-foreground">{r.profesion}</p>}

          <p className="mt-2 text-base">{r.mensaje}</p>

          <Button
            className="mt-3 w-full"
            nativeButton={false}
            render={
              <a
                href={
                  r.contacto_tipo === 'whatsapp'
                    ? `https://wa.me/57${r.contacto.replace(/\D/g, '')}`
                    : `tel:${r.contacto}`
                }
                target={r.contacto_tipo === 'whatsapp' ? '_blank' : undefined}
                rel={r.contacto_tipo === 'whatsapp' ? 'noopener noreferrer' : undefined}
              />
            }
          >
            {r.contacto_tipo === 'whatsapp' ? 'Escribir por WhatsApp' : 'Llamar'}
          </Button>

          <div className="mt-2">
            <BotonReportar tipoObjeto="respuesta" objetoId={r.id} />
          </div>
        </li>
      ))}
    </ul>
  )
}
