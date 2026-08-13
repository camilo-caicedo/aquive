'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Guardada {
  codigo: string
  token: string
  creada_at: string
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
        const { vigentes } = (await res.json()) as { vigentes: string[] }
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

  if (solicitudes === null) {
    return <p className="mt-6 text-base text-muted-foreground">Buscando…</p>
  }

  if (solicitudes.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-border p-6 text-center">
        <FileQuestion className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-base text-muted-foreground">
          No hay solicitudes guardadas en este teléfono.
        </p>
        <Button className="mt-4 w-full" nativeButton={false} render={<Link href="/publicar" />}>
          Publicar una solicitud
        </Button>
      </div>
    )
  }

  return (
    <ul className="mt-6 space-y-3">
      {solicitudes.map((s) => (
        <li key={s.token} className="rounded-lg border border-border p-4">
          <span className="font-mono text-xl font-bold">{s.codigo}</span>
          <p className="mt-1 text-sm text-muted-foreground">
            Publicada el{' '}
            {new Date(s.creada_at).toLocaleDateString('es-CO', {
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <Button
            className="mt-3 w-full"
            nativeButton={false}
            render={<Link href={`/solicitud/${s.token}`} />}
          >
            Ver respuestas
          </Button>
        </li>
      ))}
    </ul>
  )
}
