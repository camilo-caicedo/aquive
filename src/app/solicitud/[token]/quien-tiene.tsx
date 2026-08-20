import Link from 'next/link'
import { PackageOpen, MapPin, Truck, Check, SearchX, Info, Building2 } from 'lucide-react'
import type { OfertadorQueCalza } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { BotonReportar } from '@/components/boton-reportar'
import { ActivarAvisos } from '@/components/activar-avisos'
import { ContactoOfertador } from './contacto-ofertador'

/**
 * El cruce al revés: quién tiene algo de lo que pides.
 *
 * Hasta ahora esto solo iba en un sentido —quien ofrece marcaba lo que
 * tenía y le salían las solicitudes— y quien pedía no tenía más remedio que
 * publicar y esperar. Aquí se puede empezar por el otro lado.
 *
 * ⚠ Esto vive DETRÁS DEL TOKEN, y no en `/ofertadores`. La lista pública
 * sigue sin teléfono: ponerlo ahí la convertiría en un directorio de a
 * quién llamar para saber quién guarda qué, abierto a cualquiera. El
 * razonamiento entero está en la migración v3-t1.
 *
 * Los ítems van sin cantidad, como en la ficha pública: el nombre ya
 * responde «¿quién tiene agua?», y la cifra convierte la lista en un mapa
 * de existencias.
 */
export function QuienTiene({
  token,
  filas,
  acompanada,
  organizacion,
  aliado,
  yaTieneAvisos,
}: {
  token: string
  filas: OfertadorQueCalza[]
  acompanada: boolean
  /** Nombre de la fundación que ya acompaña, si la hay. */
  organizacion: string | null
  /** Nombre de una fundación disponible en el municipio, si la hay. */
  aliado: string | null
  yaTieneAvisos: boolean
}) {
  if (filas.length === 0) {
    return (
      <section className="mt-6">
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <SearchX className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-base text-muted-foreground">
            Nadie está ofreciendo lo que pides ahora mismo.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Cambia todo el día: la gente publica lo que tiene a cualquier hora,
            y tu solicitud sigue viva mientras no venza.
          </p>
        </div>

        <div className="mt-4">
          <ActivarAvisos token={token} yaTieneAvisos={yaTieneAvisos} destacado />
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Mientras tanto no tienes que hacer nada: quien vea tu solicitud puede
          responderte igual, como siempre.
        </p>
      </section>
    )
  }

  const total = filas[0].total

  return (
    <section className="mt-6">
      <p className="text-base text-muted-foreground">
        <span className="font-semibold text-foreground">
          {total} {total === 1 ? 'persona tiene' : 'personas tienen'}
        </span>{' '}
        algo de lo que pides
      </p>

      <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
        <Info className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
        <span>
          Esto sale de lo que cada quien dijo tener. AquíVe no lo comprobó y
          puede que ya no lo tenga.
        </span>
      </p>

      {/* Con fundación acompañando no aparece ningún número: es la regla M,
          y la sostiene también `destapar_contacto`, que se niega. Aquí se
          dice antes, para que nadie toque un botón que va a fallar. */}
      {acompanada && (
        <div className="mt-3 rounded-2xl border border-ok/30 bg-ok-suave p-4">
          <p className="flex items-start gap-2 text-base text-ok">
            <Building2 className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
            <span>
              {organizacion ?? 'Una fundación'} está acompañando esta solicitud.
              Ellos coordinan la entrega contigo, y por eso aquí no se
              intercambian teléfonos.
            </span>
          </p>
        </div>
      )}

      <ul className="lista-escalonada mt-3 space-y-3">
        {filas.map((o) => (
          <li key={o.id} className="animar-entrada rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <PackageOpen className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold">{o.nombre_visible}</p>
                {o.municipios.length > 0 && (
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-4 shrink-0" aria-hidden="true" />
                    En tu municipio
                  </p>
                )}
              </div>
            </div>

            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok-suave px-3 py-1 text-sm font-semibold text-ok">
              <Check className="size-4" aria-hidden="true" />
              {o.coincidencias === 1
                ? '1 de las cosas que pides'
                : `${o.coincidencias} de las cosas que pides`}
            </p>

            {o.items.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {o.items.map((it) => (
                  <li
                    key={it.nombre}
                    className={
                      it.calza
                        ? 'inline-flex items-center gap-1.5 rounded-full bg-ok-suave px-3.5 py-1.5 text-sm font-semibold text-ok'
                        : 'rounded-full bg-muted px-3.5 py-1.5 text-sm text-foreground'
                    }
                  >
                    {it.calza && <Check className="size-4" aria-hidden="true" />}
                    {it.nombre}
                    {it.por_confirmar && (
                      <span className="text-muted-foreground"> · por confirmar</span>
                    )}
                  </li>
                ))}
                {o.total_items > o.items.length && (
                  <li className="px-2 py-1 text-sm text-muted-foreground">
                    y {o.total_items - o.items.length} más
                  </li>
                )}
              </ul>
            )}

            {o.puede_trasladarse && (
              <p className="mt-3 flex items-center gap-1.5 text-base text-ok">
                <Truck className="size-4 shrink-0" aria-hidden="true" />
                Puede trasladarse a entregar
              </p>
            )}

            {o.descripcion && <p className="mt-3 text-base">{o.descripcion}</p>}

            {acompanada ? (
              <>
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  nativeButton={false}
                  render={<Link href={`/solicitud/${token}?ver=coordinacion`} />}
                >
                  <Building2 className="size-5" aria-hidden="true" />
                  Pedirlo por la fundación
                </Button>
                <p className="mt-2 text-sm text-muted-foreground">
                  Su número no aparece aquí mientras te acompañen: la fundación
                  habla con los dos.
                </p>
              </>
            ) : (
              <ContactoOfertador token={token} ofertador={o} aliado={aliado} />
            )}

            <div className="mt-3">
              <BotonReportar tipoObjeto="perfil" objetoId={o.id} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
