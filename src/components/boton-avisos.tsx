'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import {
  activarAvisos,
  avisosActivosAqui,
  desactivarAvisos,
} from '@/lib/avisos'

type Estado = 'cargando' | 'activo' | 'inactivo' | 'trabajando'

/**
 * Interruptor rápido de avisos en el encabezado.
 *
 * El estado es por dispositivo, no por cuenta: se lee del propio
 * navegador, así que refleja lo que pasa en ESTE teléfono. Apagarlo aquí
 * no apaga los avisos en el otro.
 */
export function BotonAvisos() {
  const [estado, setEstado] = useState<Estado>('cargando')
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    async function leer() {
      const activo = await avisosActivosAqui()
      if (!cancelado) setEstado(activo ? 'activo' : 'inactivo')
    }
    leer()
    return () => {
      cancelado = true
    }
  }, [])

  async function alternar() {
    if (estado === 'cargando' || estado === 'trabajando') return
    const encendiendo = estado === 'inactivo'
    setEstado('trabajando')
    setMensaje(null)

    if (encendiendo) {
      const r = await activarAvisos()
      if (r === 'activado') {
        setEstado('activo')
      } else {
        setEstado('inactivo')
        setMensaje(
          r === 'ios'
            ? 'En iPhone, agrega AquíVe a tu pantalla de inicio para recibir avisos.'
            : r === 'sin-permiso'
              ? 'Tu navegador bloqueó los avisos. Actívalos en los permisos del sitio.'
              : 'No pudimos activar los avisos.'
        )
      }
    } else {
      await desactivarAvisos()
      setEstado('inactivo')
    }
  }

  if (estado === 'cargando') {
    // Sin marcador de posición: aparecer y cambiar de icono de una vez se
    // ve peor que aparecer ya con el estado correcto.
    return null
  }

  const activo = estado === 'activo'
  const Icono = estado === 'trabajando' ? Bell : activo ? BellRing : BellOff

  return (
    <div className="relative">
      <button
        type="button"
        onClick={alternar}
        disabled={estado === 'trabajando'}
        aria-pressed={activo}
        title={activo ? 'Avisos activados en este dispositivo' : 'Avisos desactivados'}
        aria-label={
          activo
            ? 'Avisos activados en este dispositivo. Tocar para desactivar'
            : 'Avisos desactivados. Tocar para activar'
        }
        className={`flex size-11 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
          activo
            ? 'border-primary bg-accent text-accent-foreground'
            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <Icono className="size-5" aria-hidden="true" />
        {/* Punto además del icono: distingue el estado sin depender de
            notar cuál de las dos campanas es. */}
        <span
          aria-hidden="true"
          className={`absolute top-1 right-1 size-2 rounded-full ${
            activo ? 'bg-primary' : 'bg-transparent'
          }`}
        />
      </button>

      {mensaje && (
        <p
          role="status"
          className="absolute top-12 right-0 z-50 w-64 rounded-lg border border-border bg-popover p-3 text-sm shadow-md"
        >
          {mensaje}
        </p>
      )}
    </div>
  )
}
