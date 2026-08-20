'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, MessageCircle, Phone, Building2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { enlaceWhatsapp } from '@/lib/contacto'
import { AVISO_CONTACTO } from '@/lib/honestidad'
import type { ContactoDestapado, OfertadorQueCalza } from '@/lib/types'
import { HojaAccion } from '@/components/hoja-accion'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Destapar el contacto de una persona que tiene algo de lo que pides.
 *
 * ⚠ El teléfono NO viene en la lista. Llega aquí, de a uno, cuando alguien
 * toca el botón: es lo que hace que el tope de treinta por solicitud sirva
 * de algo (regla 11 y migración v3-t1). Si la lista lo trajera, una sola
 * carga se llevaría veinte números.
 *
 * Tampoco se guarda de este lado. Vive en el estado de este componente
 * mientras la hoja está abierta, y al recargar la pantalla desaparece —
 * volver a verlo es volver a pedirlo, y eso vuelve a quedar en la bitácora.
 *
 * La fundación se ofrece DEBAJO y en `outline`, una sola vez y con la
 * consecuencia escrita. El botón grande es escribir directo (regla R): el
 * acompañamiento nunca puede ser el camino de menor resistencia.
 */
export function ContactoOfertador({
  token,
  ofertador,
  aliado,
}: {
  token: string
  ofertador: OfertadorQueCalza
  /** Nombre de una fundación que trabaje en el municipio, si la hay. */
  aliado: string | null
}) {
  const [contacto, setContacto] = useState<ContactoDestapado | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function destapar() {
    if (contacto || cargando) return
    setCargando(true)
    setError(null)

    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('destapar_contacto', {
      p_token: token,
      p_perfil_id: ofertador.id,
    })

    if (rpcError) setError(rpcError.message)
    else setContacto(data as unknown as ContactoDestapado)
    setCargando(false)
  }

  const calzan = ofertador.items.filter((i) => i.calza)

  return (
    <HojaAccion
      id={`contacto-${ofertador.id}`}
      titulo={ofertador.nombre_visible}
      disparador={(props) => (
        <Button {...props} variant="outline" className="mt-3 w-full" onClick={destapar}>
          <Eye className="size-5" aria-hidden="true" />
          Ver cómo contactarlo
        </Button>
      )}
    >
      <p className="text-base text-muted-foreground">
        Tiene {calzan.map((i) => i.nombre.toLowerCase()).join(', ')}
      </p>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !contacto ? (
        // El destape lo dispara el mismo botón que abre la hoja, así que
        // cuando esto se ve la petición ya va en camino.
        <p aria-live="polite" className="mt-4 text-base text-muted-foreground">
          Buscando su contacto…
        </p>
      ) : (
        <>
          {/* El aviso completo va pegado al botón, no arriba de la lista:
              cada persona es una decisión distinta (regla 5). */}
          <p className="mt-4 text-sm text-muted-foreground">
            {AVISO_CONTACTO}{' '}
            <Link href="/seguridad" className="underline underline-offset-4">
              Cómo cuidarte
            </Link>
          </p>

          <div className="mt-3 flex items-center gap-3">
            <Button
              className="h-14 flex-1 text-lg"
              nativeButton={false}
              render={
                contacto.contacto_tipo === 'whatsapp' ? (
                  <a
                    href={enlaceWhatsapp(contacto.contacto)}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                ) : (
                  <a href={`tel:${contacto.contacto}`} />
                )
              }
            >
              {contacto.contacto_tipo === 'whatsapp' ? (
                <>
                  <MessageCircle className="size-6" aria-hidden="true" />
                  Escribir por WhatsApp
                </>
              ) : (
                <>
                  <Phone className="size-6" aria-hidden="true" />
                  Llamar
                </>
              )}
            </Button>
            {contacto.contacto_tipo === 'whatsapp' && (
              <a
                href={`tel:${contacto.contacto}`}
                aria-label="Llamar"
                className="flex size-14 shrink-0 items-center justify-center rounded-full border border-primary text-primary transition-colors hover:bg-accent"
              >
                <Phone className="size-6" aria-hidden="true" />
              </a>
            )}
          </div>

          <p className="mt-2.5 flex items-start gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
            <span>
              Ves su número porque tienes el enlace de una solicitud que pide
              esto. Él no ve quién eres, ni dónde vives, ni tu teléfono.
            </span>
          </p>
        </>
      )}

      {aliado && (
        <div className="mt-5 flex items-start gap-3 border-t border-border pt-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ok-suave text-ok">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">¿Prefieres no hablar directo?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {aliado} puede coordinar esta entrega entre los dos.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Para eso tendrías que darles tu nombre y tu documento. Desde ese
              momento los teléfonos no se intercambian aquí, y no hay vuelta
              atrás.
            </p>
            <Button
              variant="outline"
              className="mt-3 w-full"
              nativeButton={false}
              render={<Link href={`/solicitud/${token}?ver=respuestas`} />}
            >
              Pedir que lo coordinen
            </Button>
          </div>
        </div>
      )}
    </HojaAccion>
  )
}
