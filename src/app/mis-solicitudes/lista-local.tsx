'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { FileQuestion, Check, QrCode, Link2 } from 'lucide-react'
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
  /** Cuántas respuestas tiene. Es un número, no dice quién respondió. */
  num_respuestas?: number
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
  const respuestas: Record<string, number | undefined> = Object.fromEntries(
    Object.entries(datos).map(([k, v]) => [k, v.num_respuestas])
  )
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
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Buscando…</span>
        <Siluetas cuantas={2} />
      </div>
    )
  }

  if (solicitudes.length === 0) {
    return (
      <Estado
        Icono={FileQuestion}
        titulo="No hay solicitudes guardadas en este teléfono"
        detalle="Se guardan aquí al publicarlas, y solo aquí: si cambias de teléfono se pierden."
        accion={
          // Sin relleno lima: la píldora fija de la pantalla ya lleva esa
          // misma acción, y dos limas son dos acciones principales.
          <Button variant="outline" nativeButton={false} render={<Link href="/publicar" />}>
            Publicar una solicitud
          </Button>
        }
      />
    )
  }

  return (
    <ul className="space-y-3">
      {solicitudes.map((s) => (
        // Papel con canto, no arena. La fila iba en arena porque vivía
        // DENTRO de un plegable, que ya era una tarjeta blanca; desde que el
        // plegable es una pestaña, lo que hay debajo es la crema de la
        // pantalla, y ahí lo que se lee como tarjeta es el papel con su
        // sombra de 1 px — la misma receta de /ofertadores y de las filas de
        // esta misma pantalla.
        <li key={s.token} className="shadow-canto rounded-2xl bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            {/* Antes solo estaba el código. Quien publicó tres cosas
                distintas no tiene forma de saber cuál es cuál mirando cuatro
                letras: lo que reconoce es «Alimentación · Comuna 15». */}
            <p className="font-heading min-w-0 text-lg">
              {datos[s.token]
                ? `${categoriaInfo(datos[s.token].categoria as Categoria).etiqueta} · ${
                    datos[s.token].barrio
                  }`
                : 'Tu solicitud'}
            </p>
            {(respuestas[s.token] ?? 0) > 0 && (
              <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
                {respuestas[s.token]}{' '}
                {respuestas[s.token] === 1 ? 'respuesta' : 'respuestas'}
              </span>
            )}
          </div>

          <p className="mt-1 text-base text-muted-foreground">
            Publicada el{' '}
            {new Date(s.creada_at).toLocaleDateString('es-CO', {
              day: 'numeric',
              month: 'long',
            })}{' '}
            · código <span className="font-mono">{s.codigo}</span>
          </p>

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              className="border-enlace text-enlace"
              nativeButton={false}
              render={<Link href={`/solicitud/${s.token}`} />}
            >
              Ver respuestas
            </Button>
            {/* El enlace es la llave: aquí también, no solo dentro. */}
            <Button variant="outline" onClick={() => copiar(s.token)}>
              {copiado === s.token ? (
                <Check className="size-5 text-foreground" aria-hidden="true" />
              ) : (
                <Link2 className="size-5" aria-hidden="true" />
              )}
              {copiado === s.token ? 'Copiado' : 'Enlace'}
            </Button>
            <button
              type="button"
              onClick={() => setQrDe((q) => (q === s.token ? null : s.token))}
              aria-expanded={qrDe === s.token}
              aria-label="Ver el código QR"
              // Misma receta que los dos botones `outline` de al lado: sobre
              // papel, el papel no se distingue del papel.
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
