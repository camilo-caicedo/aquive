import Link from 'next/link'
import { BadgeCheck, TriangleAlert, Inbox, Truck } from 'lucide-react'
import type { SolicitudConRespuestas } from '@/lib/types'
import { enlaceWhatsapp } from '@/lib/contacto'
import { AVISO_CONTACTO, AVISO_CONTACTO_VERIFICADO } from '@/lib/honestidad'
import { Button } from '@/components/ui/button'
import { BotonReportar } from '@/components/boton-reportar'

type Respuesta = SolicitudConRespuestas['respuestas'][number]

export function ListaRespuestas({ respuestas }: { respuestas: Respuesta[] }) {
  if (respuestas.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center">
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
        <li key={r.id} className="rounded-2xl bg-card p-4 shadow-canto">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{r.nombre}</span>
            {r.tipo === 'servidor' &&
              (r.verificado ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-ok/30 bg-ok-suave px-2 py-0.5 text-sm font-medium text-foreground">
                  <BadgeCheck className="size-4" aria-hidden="true" />
                  Matrícula verificada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-enlace/25 bg-accent px-2 py-0.5 text-sm font-medium text-accent-foreground">
                  <TriangleAlert className="size-4" aria-hidden="true" />
                  Sin verificar
                </span>
              ))}
          </div>

          {r.profesion && <p className="mt-1 text-base text-muted-foreground">{r.profesion}</p>}

          <p className="mt-2 text-base">{r.mensaje}</p>

          {/* Lo dijo al responder, para que no haya que preguntarlo. Solo se
              muestra cuando es que sí: no marcarlo no afirma que no pueda. */}
          {r.puede_llevar && (
            <p className="mt-2 flex items-center gap-1.5 text-base text-foreground">
              <Truck className="size-4 shrink-0" aria-hidden="true" />
              Puede llevártelo
            </p>
          )}

          {/* Una respuesta sin contacto no debería existir: desde agosto de
              2026 `responder_solicitud` lo exige. Pero las que se
              escribieron antes de ese arreglo siguen ahí, y esta pantalla
              tiene que poder mostrarlas — antes reventaba entera y quien
              pidió ayuda no veía NINGUNA de sus respuestas. */}
          {r.contacto === null ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Esta persona no dejó una forma de contacto pública, así que no
              hay a dónde escribirle. Si vuelve a responder con su contacto,
              aparecerá aquí.
            </p>
          ) : (
            <>
              {/* El tercero de los cuatro puntos, y el que más pesa: es el
                  paso donde de verdad se decide. Va pegado al botón, no
                  arriba de la lista, porque cada persona es una decisión
                  distinta. */}
              <p className="mt-3 text-sm text-muted-foreground">
                {r.tipo === 'servidor' && r.verificado
                  ? AVISO_CONTACTO_VERIFICADO
                  : AVISO_CONTACTO}{' '}
                <Link href="/seguridad" className="text-enlace underline underline-offset-4">
                  Cómo cuidarte
                </Link>
              </p>

              <Button
                className="mt-3 w-full"
                nativeButton={false}
                render={
                  <a
                    href={
                      r.contacto_tipo === 'whatsapp'
                        ? enlaceWhatsapp(r.contacto)
                        : `tel:${r.contacto}`
                    }
                    target={r.contacto_tipo === 'whatsapp' ? '_blank' : undefined}
                    rel={r.contacto_tipo === 'whatsapp' ? 'noopener noreferrer' : undefined}
                  />
                }
              >
                {r.contacto_tipo === 'whatsapp' ? 'Escribir por WhatsApp' : 'Llamar'}
              </Button>
            </>
          )}

          <div className="mt-2">
            <BotonReportar tipoObjeto="respuesta" objetoId={r.id} />
          </div>
        </li>
      ))}
    </ul>
  )
}
