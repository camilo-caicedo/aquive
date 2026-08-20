'use client'

import { useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { Copy, Check, QrCode, Bookmark } from 'lucide-react'

/**
 * La llave de una solicitud, siempre a la vista.
 *
 * Va fija bajo el encabezado de `/solicitud/[token]` porque perder el
 * enlace es perder la solicitud: no hay cuenta, no hay correo y no se puede
 * recuperar. Antes vivía en una pestaña llamada «Tu enlace», que
 * desaparecía de la vista en cuanto llegaba la primera respuesta — justo
 * cuando la persona empieza a entrar todos los días y más veces tiene la
 * ocasión de guardarlo.
 *
 * Tres cosas y nada más: copiar, ver el QR y guardar en este teléfono. El
 * QR se genera en el navegador con `qrcode-generator`, que ya está.
 */
export function CintaEnlace({
  link,
  codigo,
  token,
}: {
  link: string
  codigo: string
  token: string
}) {
  const [copiado, setCopiado] = useState(false)
  const [verQr, setVerQr] = useState(false)
  const [guardado, setGuardado] = useState(false)

  const qrDataUrl = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(link)
    qr.make()
    return qr.createDataURL(6, 12)
  }, [link])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles el enlace sigue visible para copiarlo
      // a mano. No se avisa de un error que no impide nada.
    }
  }

  // La misma clave y la misma forma que usa `FormularioPublicar` al
  // publicar: `ListaLocal` lee de ahí, y si la forma no coincide la
  // solicitud no aparece en «Lo mío». Vive en `localStorage`, nunca en la
  // base — es una lista de este teléfono, no un dato de nadie.
  function guardarAqui() {
    try {
      const clave = 'mis_solicitudes'
      const actuales = JSON.parse(localStorage.getItem(clave) ?? '[]') as Array<{
        codigo: string
        token: string
        creada_at: string
      }>
      if (!actuales.some((s) => s.token === token)) {
        actuales.unshift({ codigo, token, creada_at: new Date().toISOString() })
        localStorage.setItem(clave, JSON.stringify(actuales))
        // `ListaLocal` escucha este evento para repintarse sin recargar.
        window.dispatchEvent(new Event('mis-solicitudes'))
      }
      setGuardado(true)
    } catch {
      // Navegación privada: no se puede guardar y no pasa nada más.
    }
  }

  return (
    <div className="sticky top-14 z-30 -mx-4 border-b border-border bg-secondary px-4 py-2 sm:top-16">
      <div className="mx-auto flex max-w-lg items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-secondary-foreground">Tu solicitud</span>
          <span className="block truncate font-mono text-lg font-bold">{codigo}</span>
        </span>

        <button
          type="button"
          onClick={copiar}
          className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
          aria-label={copiado ? 'Enlace copiado' : 'Copiar el enlace'}
        >
          {copiado ? (
            <Check className="size-5 text-ok" aria-hidden="true" />
          ) : (
            <Copy className="size-5" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setVerQr((v) => !v)}
          aria-expanded={verQr}
          className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Ver el código QR"
        >
          <QrCode className="size-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={guardarAqui}
          className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
          aria-label={guardado ? 'Guardada en este teléfono' : 'Guardar en este teléfono'}
        >
          {guardado ? (
            <Check className="size-5 text-ok" aria-hidden="true" />
          ) : (
            <Bookmark className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {verQr && (
        <div className="mx-auto mt-2 max-w-lg text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`Código QR del enlace de la solicitud ${codigo}`}
            className="mx-auto rounded-lg bg-background p-2"
            width={160}
            height={160}
          />
          <p className="mt-1 text-sm break-all text-secondary-foreground">{link}</p>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {copiado ? 'Enlace copiado' : ''}
        {guardado ? 'Guardada en este teléfono' : ''}
      </p>
    </div>
  )
}
