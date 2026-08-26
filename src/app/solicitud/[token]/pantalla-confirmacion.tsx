'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import qrcode from 'qrcode-generator'
import { AVISO_PUBLICAR } from '@/lib/honestidad'
import { Button } from '@/components/ui/button'
import { ActivarAvisos } from '@/components/activar-avisos'

export function PantallaConfirmacion({
  link,
  codigo,
  sinRespuestas,
  token,
  yaTieneAvisos,
}: {
  link: string
  codigo: string
  /** El aviso habla en futuro, así que sobra cuando ya hay respuestas. */
  sinRespuestas: boolean
  token: string
  yaTieneAvisos: boolean
}) {
  const [copiado, setCopiado] = useState(false)

  const qrDataUrl = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(link)
    qr.make()
    return qr.createDataURL(6, 12)
  }, [link])

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles: el enlace ya está visible para copiar a mano.
    }
  }

  return (
    <div className="space-y-4">
      {/* El código sobre tinta, no sobre el papel: es el único dato de esta
          pantalla que hay que copiar a mano si todo lo demás falla, y sobre
          crema quedaba como un titular más. En Geist Mono, que es lo que
          manda la identidad para los códigos, y con la etiqueta en lima
          —relleno oscuro debajo, así el lima sí puede ser letra aquí—. */}
      <div className="rounded-2xl bg-foreground p-5">
        <p className="font-heading text-xs tracking-[0.085em] text-primary uppercase">
          Tu código de solicitud
        </p>
        <p className="mt-3 font-mono text-5xl leading-none font-bold tracking-[0.12em] text-background">
          {codigo}
        </p>
        <p className="mt-3 text-base text-background/75">
          Tu solicitud quedó publicada. Guarda este enlace: es la única forma
          de volver, y no podemos recuperarlo si lo pierdes.
        </p>
        <p className="mt-3 rounded-xl bg-background/10 p-3 text-sm break-all text-background/75">
          {link}
        </p>
      </div>

      {/* Antes que el enlace, y con el botón grande. Estuvo escondido en la
          cuarta pestaña hasta agosto de 2026, y el resultado fue medible:
          cero suscripciones en producción. Sin avisos, quien pide tiene que
          acordarse de volver a mirar, y no vuelve.

          Se ofrece con un botón porque el navegador exige un gesto: lanzarlo
          solo no funciona, y donde funcionara saldría sin contexto y le
          darían a «Bloquear», que no se puede deshacer. */}
      <ActivarAvisos token={token} destacado yaTieneAvisos={yaTieneAvisos} />

      {/* Solo mientras no haya respuestas: esta pantalla se ve en cada
          visita al enlace, no solo al publicar, y el aviso habla en futuro.
          Con respuestas ya visibles abajo, el que aplica es el que va
          pegado a cada botón de contacto.

          El aviso de «guarda el enlace» ya no se repite aquí: lo dice el
          bloque de arriba, pegado al código, y dos veces la misma frase en
          una pantalla se lee como textura (regla 5). */}
      {sinRespuestas && (
        <p className="text-sm text-muted-foreground">
          {AVISO_PUBLICAR}{' '}
          <Link href="/seguridad" className="text-enlace underline underline-offset-4">
            Cómo cuidarte
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button type="button" className="w-full" onClick={copiarEnlace}>
          {copiado ? 'Enlace copiado' : 'Copiar enlace'}
        </Button>

        {/* eslint-disable-next-line @next/next/no-img-element -- data URI generada en cliente, no aplica optimización de next/image */}
        <img
          src={qrDataUrl}
          alt="Código QR de tu solicitud"
          className="shadow-canto mx-auto h-40 w-40 rounded-xl bg-card p-2"
          width={160}
          height={160}
        />
        <Button
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={<a href={qrDataUrl} download="aquive-mi-solicitud.gif" />}
        >
          Descargar QR
        </Button>

        <Button
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Guardé mi solicitud en AquíVe: ${link}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          Enviármelo por WhatsApp
        </Button>
      </div>
    </div>
  )
}
