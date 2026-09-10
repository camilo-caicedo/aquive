'use client'

import { Info } from 'lucide-react'
import { HojaAccion } from '@/components/hoja-accion'
import { NO_PAGUES_POR_ADELANTADO, SEGURIDAD_DOMICILIO } from '@/lib/honestidad'

/**
 * Botón flotante discreto (ⓘ) en la ficha que abre una hoja inferior
 * con la advertencia completa sobre pagos y seguridad.
 *
 * ADR 0022: Quita el bloque fijo de la ficha y lo pasa a un botón/icono
 * flotante con área táctil accesible de 48px, mostrando el texto completo al tocarlo.
 */
export function BotonInfoDinero({ aDomicilio }: { aDomicilio?: boolean }) {
  return (
    <div className="fixed right-4 bottom-24 z-30">
      <HojaAccion
        id="aviso-dinero-ficha"
        titulo="Seguridad y pagos"
        disparador={(props) => (
          <button
            {...props}
            aria-label="Información sobre pagos y seguridad"
            className="pulsable flex size-12 items-center justify-center rounded-full bg-card text-foreground shadow-canto transition-transform hover:scale-105 active:scale-95"
          >
            <Info className="size-6 text-enlace" aria-hidden="true" />
          </button>
        )}
      >
        <div className="space-y-4">
          <p className="text-base text-muted-foreground">{NO_PAGUES_POR_ADELANTADO}</p>
          {aDomicilio && (
            <p className="text-base text-muted-foreground">{SEGURIDAD_DOMICILIO}</p>
          )}
        </div>
      </HojaAccion>
    </div>
  )
}
