'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { FileQuestion, MapPin, Copy, Check, QrCode } from 'lucide-react'
import qrcode from 'qrcode-generator'
import { categoria as categoriaInfo } from '@/lib/catalogo'
import type { Categoria } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Estado, Siluetas } from '@/components/estado'

interface Guardada {
  codigo: string
  token: string
  creada_at: string
}

/** Lo que el servidor sabe de una solicitud viva. Nada de esto identifica
 *  a nadie: municipio y barrio es lo más fino que existe (regla 1). */
interface DatosVivos {
  categoria: string
  barrio: string
}

const CLAVE = 'mis_solicitudes'

// localStorage es un store externo: useSyncExternalStore lo lee sin
// provocar un render en cascada y da un valor distinto en servidor
// (null) y en cliente, sin desajuste de hidratación.
function suscribir(alCambiar: () => void) {
  window.addEventListener('storage', alCambiar)
  window.addEventListener('mis-solicitudes', alCambiar)
  return () => {
    window.removeEventListener('storage', alCambiar)
    window.removeEventListener('mis-solicitudes', alCambiar)
  }
}

// El '[]' importa: sin él, "no hay nada guardado" y "todavía no leemos"
// serían ambos null y la pantalla se quedaría en "Buscando…" para siempre.
const leerCliente = () => localStorage.getItem(CLAVE) ?? '[]'
const leerServidor = () => null

export function ListaLocal() {
  const crudo = useSyncExternalStore(suscribir, leerCliente, leerServidor)
  const [depurado, setDepurado] = useState(false)
  const [datos, setDatos] = useState<Record<string, DatosVivos>>({})
  const [copiado, setCopiado] = useState<string | null>(null)
  const [qrDe, setQrDe] = useState<string | null>(null)

  const solicitudes = useMemo<Guardada[] | null>(() => {
    if (crudo === null) return null
    try {
      return JSON.parse(crudo) as Guardada[]
    } catch {
      return []
    }
  }, [crudo])

  // El teléfono no se entera de que una solicitud venció o se cerró: el
  // token solo vive aquí. Se le pregunta al servidor una vez y se quitan
  // las que ya no existen, para no dejar tarjetas que llevan a la nada.
  useEffect(() => {
    if (depurado || !solicitudes || solicitudes.length === 0) return
    let cancelado = false

    async function depurar(lista: Guardada[]) {
      try {
        const res = await fetch('/api/solicitudes/vigentes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens: lista.map((s) => s.token) }),
        })
        if (!res.ok || cancelado) return
        const { vigentes, datos: nuevos } = (await res.json()) as {
          vigentes: string[]
          datos?: Record<string, DatosVivos>
        }
        if (nuevos) setDatos(nuevos)
        const vivas = lista.filter((s) => vigentes.includes(s.token))
        if (vivas.length !== lista.length) {
          localStorage.setItem(CLAVE, JSON.stringify(vivas))
          window.dispatchEvent(new Event('mis-solicitudes'))
        }
      } catch {
        // Sin conexión se deja la lista como está: es preferible una
        // tarjeta vencida a borrar un enlace que no se puede recuperar.
      } finally {
        if (!cancelado) setDepurado(true)
      }
    }

    depurar(solicitudes)
    return () => {
      cancelado = true
    }
  }, [solicitudes, depurado])

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/solicitud/${token}`)
      setCopiado(token)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      // Sin permiso de portapapeles: el enlace se abre igual con el botón.
    }
  }

  function qrDataUrl(token: string) {
    const qr = qrcode(0, 'M')
    qr.addData(`${window.location.origin}/solicitud/${token}`)
    qr.make()
    return qr.createDataURL(6, 12)
  }

  if (solicitudes === null) {
    // «Buscando…» se conserva para el lector de pantalla; lo que se ve son
    // las siluetas de las tarjetas que están por llegar.
    return (
      <div className="mt-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Buscando…</span>
        <Siluetas cuantas={2} />
      </div>
    )
  }

  if (solicitudes.length === 0) {
    return (
      <div className="mt-6">
        <Estado
          Icono={FileQuestion}
          titulo="No hay solicitudes guardadas en este teléfono"
          detalle="Se guardan aquí al publicarlas, y solo aquí: si cambias de teléfono se pierden."
          accion={
            <Button nativeButton={false} render={<Link href="/publicar" />}>
              Publicar una solicitud
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <ul className="mt-6 space-y-3">
      {solicitudes.map((s) => (
        <li key={s.token} className="rounded-2xl bg-card p-4 shadow-sm">
          {/* Antes solo estaba el código. Quien publicó tres cosas distintas
              no tiene forma de saber cuál es cuál mirando cuatro letras: lo
              que reconoce es «Agua y aseo, El Jordán». */}
          <p className="text-lg font-semibold">
            {datos[s.token] ? categoriaInfo(datos[s.token].categoria as Categoria).etiqueta : 'Tu solicitud'}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-base text-muted-foreground">
            {datos[s.token] && (
              <>
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                {datos[s.token].barrio}
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="font-mono text-sm">{s.codigo}</span>
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Publicada el{' '}
            {new Date(s.creada_at).toLocaleDateString('es-CO', {
              day: 'numeric',
              month: 'long',
            })}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1"
              nativeButton={false}
              render={<Link href={`/solicitud/${s.token}`} />}
            >
              Ver respuestas
            </Button>
            {/* El enlace es la llave: aquí también, no solo dentro. */}
            <button
              type="button"
              onClick={() => copiar(s.token)}
              aria-label={copiado === s.token ? 'Enlace copiado' : 'Copiar el enlace'}
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              {copiado === s.token ? (
                <Check className="size-5 text-ok" aria-hidden="true" />
              ) : (
                <Copy className="size-5" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setQrDe((q) => (q === s.token ? null : s.token))}
              aria-expanded={qrDe === s.token}
              aria-label="Ver el código QR"
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              <QrCode className="size-5" aria-hidden="true" />
            </button>
          </div>

          {qrDe === s.token && (
            <div className="mt-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl(s.token)}
                alt={`Código QR de la solicitud ${s.codigo}`}
                className="mx-auto rounded-lg bg-background p-2"
                width={160}
                height={160}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
