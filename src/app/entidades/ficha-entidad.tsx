import { Building2, MapPin, ExternalLink } from 'lucide-react'

import { esEnlaceSeguro } from '@/lib/validacion'
import { AVISO_SALIR_DEL_SITIO, dominioDe } from '@/lib/honestidad'
import { BotonReportar } from '@/components/boton-reportar'
import { Button } from '@/components/ui/button'
import type { Entidad } from '@/contrato/servicios'

/**
 * La ficha de una organización del directorio.
 *
 * El mismo bloque en la lista y en su propia pantalla. El distintivo es gris
 * y sin ícono de verificación **a propósito**: a un scroll de distancia está
 * el sello verde de «Matrícula verificada», y si los dos se parecieran, la
 * gente aprendería que una píldora significa aval. Aquí no significa nada
 * más que «esto es una organización».
 *
 * `municipios` llega con nombres, no con códigos DANE: quien pinta esto no
 * tiene por qué traerse la tabla de municipios para poder escribir «Cali».
 */
export function FichaEntidad({
  entidad: e,
  mostrarNombre = true,
}: {
  entidad: Entidad
  mostrarNombre?: boolean
}) {
  const enlaces = e.enlaces.filter((enlace) => esEnlaceSeguro(enlace.url))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
          <Building2 className="size-4" aria-hidden="true" />
          Entidad
        </span>
        {mostrarNombre && <span className="text-lg font-bold">{e.nombre}</span>}
      </div>

      {e.subtitulo && <p className="mt-1 text-base">{e.subtitulo}</p>}

      <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="size-4 shrink-0" aria-hidden="true" />
        {e.cobertura === 'nacional' ? 'Todo el país' : e.municipios.join(' · ')}
      </p>

      {e.descripcion && <p className="mt-3 text-base">{e.descripcion}</p>}

      {enlaces.length > 0 && (
        <>
          <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
            {AVISO_SALIR_DEL_SITIO}
          </p>
          <ul className="mt-3 space-y-3">
            {enlaces.map((enlace) => (
              <li key={`${enlace.etiqueta}|${enlace.url}`}>
                <Button
                  variant="outline"
                  className="w-full border-enlace text-enlace"
                  nativeButton={false}
                  render={
                    <a
                      href={enlace.url}
                      target="_blank"
                      // `nofollow ugc` no es cosmético: sin ellos AquíVe
                      // presta su posicionamiento a terceros y el directorio
                      // se vuelve objetivo de spam.
                      rel="noopener noreferrer nofollow ugc"
                    />
                  }
                >
                  <ExternalLink className="size-5" aria-hidden="true" />
                  {enlace.etiqueta}
                  <span className="sr-only"> (se abre en otro sitio)</span>
                </Button>
                {/* El dominio primero y aparte: en 320px una dirección larga
                    lo empuja fuera de la vista, y el dominio es lo único que
                    decide a dónde vas. La dirección completa se envuelve,
                    nunca se recorta con puntos suspensivos — recortar por el
                    medio es justo lo que escondería un «…@evil.com». */}
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

      {/* Una ficha sin enlaces se quedaba muda: se leía el nombre, la
          cobertura, y después nada, como si estuviera a medio hacer. Lo que
          hay que decir es qué hacer en su lugar. */}
      {enlaces.length === 0 && (
        <p className="mt-3 text-base text-muted-foreground">
          Esta organización no publicó un sitio ni un teléfono aquí. Búscala
          por su nombre o pregunta en la alcaldía de tu municipio.
        </p>
      )}

      {e.pie && (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          {e.pie}
        </p>
      )}

      <div className="mt-3">
        <BotonReportar tipoObjeto="entidad" objetoId={e.id} />
      </div>
    </>
  )
}
