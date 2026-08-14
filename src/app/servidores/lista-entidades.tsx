import { Building2, MapPin, ExternalLink, Inbox } from 'lucide-react'
import type { Database } from '@/lib/types'
import { esEnlaceSeguro } from '@/lib/validacion'
import { AVISO_SALIR_DEL_SITIO, dominioDe } from '@/lib/honestidad'
import { BotonReportar } from '@/components/boton-reportar'
import { Button } from '@/components/ui/button'

type Entidad = Database['public']['Views']['entidades_publicas']['Row']

/**
 * Las fichas del directorio.
 *
 * El distintivo es gris y sin ícono de verificación **a propósito**: a un
 * scroll de distancia está el sello verde de "Matrícula verificada", y si
 * los dos se parecieran, la gente aprendería que una píldora significa aval.
 * Aquí no significa nada más que "esto es una organización".
 */
export function ListaEntidades({
  entidades,
  nombreMunicipio,
}: {
  entidades: Entidad[]
  nombreMunicipio: Map<string, string>
}) {
  if (entidades.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center">
        <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-base text-muted-foreground">
          Todavía no hay entidades en esta lista.
        </p>
      </div>
    )
  }

  return (
    <ul className="mt-6 space-y-3">
      {entidades.map((e) => (
        <li key={e.id} className="rounded-lg border border-border p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
              <Building2 className="size-4" aria-hidden="true" />
              Entidad
            </span>
            <span className="text-lg font-bold">{e.nombre}</span>
          </div>

          {e.subtitulo && <p className="mt-1 text-base">{e.subtitulo}</p>}

          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {e.cobertura === 'nacional'
              ? 'Todo el país'
              : e.municipios.map((c) => nombreMunicipio.get(c) ?? c).join(' · ')}
          </p>

          {e.descripcion && <p className="mt-3 text-base">{e.descripcion}</p>}

          {e.enlaces.length > 0 && (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                {AVISO_SALIR_DEL_SITIO}
              </p>
              <ul className="mt-2 space-y-3">
                {e.enlaces
                  // Última red antes de pintar. React no sanea `href`:
                  // renderiza `javascript:` sin quejarse. Si algo se coló
                  // antes del CHECK, aquí se muestra sin enlace.
                  .filter((enlace) => esEnlaceSeguro(enlace.url))
                  .map((enlace) => (
                    <li key={enlace.url}>
                      <Button
                        variant="outline"
                        className="w-full"
                        nativeButton={false}
                        render={
                          <a
                            href={enlace.url}
                            target="_blank"
                            // `nofollow ugc` no es cosmético: sin ellos
                            // AquíVe presta su posicionamiento a terceros y
                            // el directorio se vuelve objetivo de spam.
                            rel="noopener noreferrer nofollow ugc"
                          />
                        }
                      >
                        <ExternalLink className="size-5" aria-hidden="true" />
                        {enlace.etiqueta}
                        <span className="sr-only"> (se abre en otro sitio)</span>
                      </Button>
                      {/* El dominio primero y aparte: en 320px una dirección
                          larga lo empuja fuera de la vista, y el dominio es
                          lo único que decide a dónde vas. La dirección
                          completa se envuelve, nunca se recorta con puntos
                          suspensivos — recortar por el medio es justo lo que
                          escondería un «…@evil.com». */}
                      <p className="mt-1 text-sm text-muted-foreground">
                        Te lleva a{' '}
                        <span className="font-medium text-foreground">
                          {dominioDe(enlace.url)}
                        </span>
                      </p>
                      <p className="break-all text-sm text-muted-foreground" dir="ltr">
                        {enlace.url}
                      </p>
                    </li>
                  ))}
              </ul>
            </>
          )}

          {e.pie && (
            <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
              {e.pie}
            </p>
          )}

          <div className="mt-3">
            <BotonReportar tipoObjeto="entidad" objetoId={e.id} />
          </div>
        </li>
      ))}
    </ul>
  )
}
