'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import qrcode from 'qrcode-generator'
import { AVISO_PUBLICAR } from '@/lib/honestidad'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function PantallaConfirmacion({
  link,
  codigo,
  sinRespuestas,
}: {
  link: string
  codigo: string
  /** El aviso habla en futuro, así que sobra cuando ya hay respuestas. */
  sinRespuestas: boolean
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
    <div className="space-y-4 text-center">
      <p className="text-base text-muted-foreground">Tu solicitud quedó publicada</p>
      <p className="text-5xl font-bold tracking-wide">{codigo}</p>

      <Alert variant="warning">
        <AlertDescription className="text-amber-900">
          Guarda este enlace. Es la única forma de volver a tu solicitud — no
          podemos recuperarlo si lo pierdes.
        </AlertDescription>
      </Alert>

      {/* Solo mientras no haya respuestas: esta pantalla se ve en cada
          visita al enlace, no solo al publicar, y el aviso habla en futuro.
          Con respuestas ya visibles abajo, el que aplica es el que va
          pegado a cada botón de contacto. */}
      {sinRespuestas && (
        <p className="text-left text-sm text-muted-foreground">
          {AVISO_PUBLICAR}{' '}
          <Link href="/seguridad" className="underline">
            Cómo cuidarte
          </Link>
        </p>
      )}

      <div className="break-all rounded-lg border border-border p-3 text-sm">{link}</div>

      <div className="flex flex-col gap-2">
        <Button type="button" className="w-full" onClick={copiarEnlace}>
          {copiado ? 'Enlace copiado' : 'Copiar enlace'}
        </Button>

        {/* eslint-disable-next-line @next/next/no-img-element -- data URI generada en cliente, no aplica optimización de next/image */}
        <img
          src={qrDataUrl}
          alt="Código QR de tu solicitud"
          className="mx-auto h-40 w-40"
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
