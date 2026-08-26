'use client'

import { useMemo, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Briefcase, ChevronRight } from 'lucide-react'
import { Estado, Siluetas } from '@/components/estado'

interface GuardadaServicio {
  codigo: string
  token: string
  fecha: number
}

const CLAVE = 'aquive_servicios'

// El mismo store externo que `ListaLocal`, con su propia clave: son dos
// módulos distintos y sus tokens no se mezclan.
function suscribir(alCambiar: () => void) {
  window.addEventListener('storage', alCambiar)
  window.addEventListener('mis-servicios', alCambiar)
  return () => {
    window.removeEventListener('storage', alCambiar)
    window.removeEventListener('mis-servicios', alCambiar)
  }
}

const leerCliente = () => localStorage.getItem(CLAVE) ?? '[]'
const leerServidor = () => null

/**
 * Las solicitudes de servicio publicadas desde este teléfono.
 *
 * ⚠ Existían y no había ninguna pantalla donde verlas: `/servicios/publicar`
 * guardaba el token en `localStorage` —igual que `/publicar`— y ahí se
 * quedaba. Quien cerraba sin copiar el enlace perdía su solicitud aunque el
 * teléfono lo tuviera guardado.
 *
 * No se depuran contra el servidor, al revés que las de insumos: aquellas
 * viven 72 horas y una tarjeta vencida lleva a la nada, mientras que una
 * solicitud de servicio vive 15 días renovables. Cuando haga falta, el
 * endpoint es el mismo patrón que `/api/solicitudes/vigentes`.
 */
export function ListaServicios() {
  const crudo = useSyncExternalStore(suscribir, leerCliente, leerServidor)

  const solicitudes = useMemo<GuardadaServicio[] | null>(() => {
    if (crudo === null) return null
    try {
      return JSON.parse(crudo) as GuardadaServicio[]
    } catch {
      return []
    }
  }, [crudo])

  if (solicitudes === null) return <Siluetas cuantas={2} />

  if (solicitudes.length === 0) {
    return (
      <Estado
        Icono={Briefcase}
        titulo="No has pedido ningún servicio"
        detalle="Lo que publiques en el directorio aparece aquí, guardado en este teléfono."
      />
    )
  }

  return (
    <ul className="space-y-2">
      {solicitudes.map((s) => (
        <li key={s.token}>
          <Link
            href={`/servicios/solicitud/${s.token}`}
            // Papel con canto, por lo mismo que en `lista-local`: desde que
            // el plegable es una pestaña, debajo hay crema y no una tarjeta
            // blanca.
            className="shadow-canto flex min-h-16 items-center gap-3 rounded-2xl bg-card p-4 transition-colors hover:bg-muted"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-enlace">
              <Briefcase className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-base font-bold">{s.codigo}</span>
              <span className="block text-sm text-muted-foreground">
                Publicada el{' '}
                {new Date(s.fecha).toLocaleDateString('es-CO', {
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
