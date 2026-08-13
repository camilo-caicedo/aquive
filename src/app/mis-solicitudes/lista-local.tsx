'use client'

import { useMemo, useSyncExternalStore } from 'react'
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
  return () => window.removeEventListener('storage', alCambiar)
}

// El '[]' importa: sin él, "no hay nada guardado" y "todavía no leemos"
// serían ambos null y la pantalla se quedaría en "Buscando…" para siempre.
const leerCliente = () => localStorage.getItem(CLAVE) ?? '[]'
const leerServidor = () => null

export function ListaLocal() {
  const crudo = useSyncExternalStore(suscribir, leerCliente, leerServidor)

  const solicitudes = useMemo<Guardada[] | null>(() => {
    if (crudo === null) return null
    try {
      return JSON.parse(crudo) as Guardada[]
    } catch {
      return []
    }
  }, [crudo])

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
