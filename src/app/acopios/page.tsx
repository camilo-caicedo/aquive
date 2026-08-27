import Link from 'next/link'
import { Clock, MapPin, MessageCircle, Phone } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { MapaDeAcopios } from '@/components/mapa-de-acopios'
import { enlaceWhatsapp } from '@/lib/contacto'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Dónde entregar' }

/**
 * Los centros de acopio (ADR 0008).
 *
 * Quien tiene algo que donar necesita saber dónde dejarlo, y hasta ahora no
 * había dónde mirarlo: la dirección de acopio existía en la base desde que
 * se escribió la tabla y no se enseñaba en ninguna parte.
 *
 * ⚠ El punto del mapa aquí no lleva casilla de consentimiento, a diferencia
 * del de un prestador (ADR 0004): la dirección de una bodega no es el
 * domicilio de una persona. Es la única diferencia entre los dos mapas, y
 * es la que justifica que se traten distinto.
 */
export default async function AcopiosPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string }>
}) {
  const { municipio } = await searchParams
  const supabase = await createClient()

  const [acopios, municipios] = await Promise.all([
    servidor.acopios.lista({ municipio }),
    listarMunicipios(supabase),
  ])
  const nombreMunicipio = mapaDeNombres(municipios)

  const enElMapa = acopios.filter((a) => a.latitud !== null && a.longitud !== null)
  const fueraDelMapa = acopios.length - enElMapa.length

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Dónde entregar" volver="/muro" />

      <p className="text-base text-muted-foreground">
        Puntos donde puedes dejar lo que vas a donar. Los lleva gente de la
        zona: llama antes de ir, para no cargar con la caja en balde.
      </p>

      {acopios.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
          {municipio
            ? 'Todavía no hay ningún punto en ese municipio.'
            : 'Todavía no hay ningún punto de entrega.'}
        </p>
      ) : (
        <>
          {enElMapa.length > 0 && (
            <div className="mt-6">
              <MapaDeAcopios acopios={enElMapa} />
            </div>
          )}

          {/* Lo que el mapa no enseña, dicho donde se mira el mapa. */}
          {fueraDelMapa > 0 && enElMapa.length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {fueraDelMapa === 1
                ? 'Hay 1 punto más que no puso su ubicación en el mapa.'
                : `Hay ${fueraDelMapa} puntos más que no pusieron su ubicación.`}{' '}
              Están en la lista.
            </p>
          )}

          <ul className="mt-6 space-y-3">
            {acopios.map((a) => (
              <li key={a.id} className="shadow-canto rounded-2xl bg-card p-4">
                <h2 className="font-heading text-lg leading-tight">{a.nombre}</h2>

                <p className="mt-1 text-base text-muted-foreground">
                  {a.municipios.map((m) => nombreMunicipio.get(m) ?? m).join(' · ')}
                </p>

                {a.direccion && (
                  <p className="mt-2 flex items-start gap-2 text-base">
                    <MapPin
                      className="size-5 shrink-0 translate-y-0.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {a.direccion}
                  </p>
                )}

                {a.horario && (
                  <p className="mt-1 flex items-start gap-2 text-base">
                    <Clock
                      className="size-5 shrink-0 translate-y-0.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {a.horario}
                  </p>
                )}

                {a.telefono && (
                  <div className="mt-3 flex items-center gap-2">
                    <a
                      href={enlaceWhatsapp(a.telefono)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-primary text-primary-foreground shadow-boton active:shadow-boton-hundido inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 text-base font-semibold transition-all active:translate-x-[2px] active:translate-y-[2px]"
                    >
                      <MessageCircle className="size-5" aria-hidden="true" />
                      Escribir antes de ir
                    </a>
                    <a
                      href={`tel:${a.telefono}`}
                      aria-label={`Llamar a ${a.nombre}`}
                      className="border-enlace text-enlace hover:bg-accent flex size-12 shrink-0 items-center justify-center rounded-full border transition-colors"
                    >
                      <Phone className="size-5" aria-hidden="true" />
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Estos puntos los da de alta un administrador, después de mirar el
        certificado de existencia y el NIT. Aparecer aquí no es un aval de
        AquíVe sobre lo que hagan con lo que reciben.
      </p>

      <p className="mt-4 text-base">
        ¿Prefieres entregarlo tú?{' '}
        <Link href="/muro" className="text-enlace underline underline-offset-4">
          Publícalo en el muro
        </Link>{' '}
        y lo acuerdas con quien lo necesite.
      </p>
    </main>
  )
}
