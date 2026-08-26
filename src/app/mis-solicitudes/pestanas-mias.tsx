'use client'

import { useState, useSyncExternalStore } from 'react'
import { ListaLocal } from './lista-local'
import { ListaServicios } from './lista-servicios'

type Cual = 'servicios' | 'ayuda'

/**
 * Las dos listas de «lo que pedí», en un segmentado con contador.
 *
 * Antes eran dos `SeccionPlegable`. El contador es lo que un plegable no
 * puede dar: para saber si hay algo dentro había que abrirlo, y quien viene
 * a mirar si le respondieron necesita saberlo antes de tocar nada.
 *
 * ⚠ Lo que NO se aplana es que son dos módulos con vidas distintas: los
 * servicios duran 15 días renovables y las ayudas 72 horas. Por eso siguen
 * siendo dos listas y no una con filtro, y por eso cada pestaña dice su vida
 * útil debajo — es el dato que decide si hay que volver hoy o la semana que
 * viene.
 *
 * ⚠ Cliente a la fuerza: los dos contadores salen de `localStorage`, que el
 * servidor no ve. De ahí que el segmentado sean botones con `aria-pressed` y
 * no enlaces con el estado en la URL, como hace `Pestanas`: aquí no hay ruta
 * que compartir, la lista vive en este teléfono.
 */

// Servicios va primero: es el módulo que hoy recibe a la gente y el que
// tiene solicitudes que duran, así que es la lista a la que se vuelve.
const PESTANAS = [
  {
    cual: 'servicios' as const,
    etiqueta: 'Servicios',
    vida: 'Oficios que pediste en el directorio. Duran 15 días y se renuevan con un toque.',
  },
  {
    cual: 'ayuda' as const,
    etiqueta: 'Ayuda',
    vida: 'Insumos que pediste para la emergencia. Se borran solas a las 72 horas.',
  },
]

function suscriptor(evento: string) {
  return (alCambiar: () => void) => {
    window.addEventListener('storage', alCambiar)
    window.addEventListener(evento, alCambiar)
    return () => {
      window.removeEventListener('storage', alCambiar)
      window.removeEventListener(evento, alCambiar)
    }
  }
}

const susServicios = suscriptor('mis-servicios')
const susAyuda = suscriptor('mis-solicitudes')
const leerServicios = () => localStorage.getItem('aquive_servicios') ?? '[]'
const leerAyuda = () => localStorage.getItem('mis_solicitudes') ?? '[]'
// En servidor no hay lista todavía; `undefined` en el contador es «aún no se
// sabe», que no es lo mismo que cero y no pinta un «0» que luego cambia.
const enServidor = () => null

function cuantas(crudo: string | null) {
  if (crudo === null) return undefined
  try {
    const lista = JSON.parse(crudo) as unknown
    return Array.isArray(lista) ? lista.length : 0
  } catch {
    return 0
  }
}

export function PestanasMias() {
  const [cual, setCual] = useState<Cual>('servicios')
  const cuenta: Record<Cual, number | undefined> = {
    servicios: cuantas(useSyncExternalStore(susServicios, leerServicios, enServidor)),
    ayuda: cuantas(useSyncExternalStore(susAyuda, leerAyuda, enServidor)),
  }
  const activa = PESTANAS.find((p) => p.cual === cual)!

  return (
    <div className="mt-4">
      <div className="riel -mx-4 overflow-x-auto px-4">
        <div
          role="group"
          aria-label="Qué solicitudes ver"
          className="inline-flex w-full min-w-fit items-center gap-1 rounded-full bg-secondary p-1.5"
        >
          {PESTANAS.map((p) => {
            const esta = p.cual === cual
            return (
              <button
                key={p.cual}
                type="button"
                onClick={() => setCual(p.cual)}
                aria-pressed={esta}
                // Misma forma que `Pestanas`: papel elevado con canto y peso
                // de letra para la activa, nunca relleno lima —el lima de
                // esta pantalla es la píldora fija de abajo—.
                className={`inline-flex min-h-12 w-full min-w-fit flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-base whitespace-nowrap transition-colors ${
                  esta
                    ? 'shadow-canto bg-card font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.etiqueta}
                {(cuenta[p.cual] ?? 0) > 0 && (
                  <span
                    className={`rounded-full px-2 text-sm ${
                      esta
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-background text-muted-foreground'
                    }`}
                  >
                    {cuenta[p.cual]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{activa.vida}</p>

      <div className="mt-3">
        {cual === 'servicios' ? <ListaServicios /> : <ListaLocal />}
      </div>
    </div>
  )
}
