'use client'

import { useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { Link2, Copy, Check, QrCode, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * La llave de una solicitud, siempre a la vista.
 *
 * Va bajo el encabezado de `/solicitud/[token]` porque perder el enlace es
 * perder la solicitud: no hay cuenta, no hay correo y no se puede
 * recuperar. Antes vivía en una pestaña llamada «Tu enlace», que
 * desaparecía de la vista en cuanto llegaba la primera respuesta — justo
 * cuando la persona empieza a entrar todos los días y más veces tiene la
 * ocasión de guardarlo.
 *
 * Copiar es lo único que va en grande: es lo que resuelve el problema de
 * verdad —mandárselo a alguien de confianza, pegarlo en una nota—. El QR y
 * «guardar aquí» son dos botones pequeños al lado, que se usan una vez.
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
    // Sobre tinta, igual que la pantalla de confirmación: es la llave, y la
    // llave se mira aparte del resto de la pantalla. Antes era una franja de
    // amarillo pálido con borde azul, del mismo peso que los tres avisos que
    // vienen debajo, y se leía como uno más.
    <div className="rounded-2xl bg-foreground p-4 text-background">
      <div className="flex items-center gap-3">
        <Link2 className="size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-xs tracking-[0.085em] text-primary uppercase">
            Tu solicitud
          </p>
          <p className="mt-0.5 font-mono text-xl leading-none font-bold tracking-[0.12em]">
            {codigo}
          </p>
        </div>
        {/* Arena y no lima: sobre la tinta ya destaca sola, y el lima de
            esta pantalla es de la acción de la pestaña que se esté viendo
            —responder, confirmar, activar avisos— (regla 1). */}
        <Button variant="secondary" className="shrink-0" onClick={copiar}>
          {copiado ? (
            <Check className="size-5" aria-hidden="true" />
          ) : (
            <Copy className="size-5" aria-hidden="true" />
          )}
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
      </div>

      <p className="mt-3 text-sm text-background/75">
        Guarda este enlace: es la única llave. No hay cuenta ni contraseña que
        recuperar.
      </p>

      <div className="mt-1 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => setVerQr((v) => !v)}
          aria-expanded={verQr}
          className="inline-flex min-h-12 items-center gap-1.5 text-sm underline underline-offset-4"
        >
          <QrCode className="size-4 shrink-0" aria-hidden="true" />
          {verQr ? 'Ocultar el QR' : 'Ver el QR'}
        </button>
        <button
          type="button"
          onClick={guardarAqui}
          className="inline-flex min-h-12 items-center gap-1.5 text-sm underline underline-offset-4"
        >
          {guardado ? (
            <Check className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <Bookmark className="size-4 shrink-0" aria-hidden="true" />
          )}
          {guardado ? 'Guardada aquí' : 'Guardar en este teléfono'}
        </button>
      </div>

      {verQr && (
        <div className="mt-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`Código QR del enlace de la solicitud ${codigo}`}
            className="mx-auto rounded-xl bg-card p-2"
            width={160}
            height={160}
          />
          <p className="mt-2 text-sm break-all text-background/75">{link}</p>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {copiado ? 'Enlace copiado' : ''}
        {guardado ? 'Guardada en este teléfono' : ''}
      </p>
    </div>
  )
}
