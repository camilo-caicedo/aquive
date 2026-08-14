'use client'

import { useEffect, useState } from 'react'
import { Bell, BellRing, BellOff, Share } from 'lucide-react'
import { activarAvisos, avisosActivosAqui, desactivarAvisos } from '@/lib/avisos'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

type Estado = 'cargando' | 'activo' | 'inactivo' | 'trabajando' | 'ios' | 'error'

/**
 * Explica qué son los avisos y deja activarlos. El interruptor rápido del
 * encabezado hace lo mismo; esto es lo que la gente encuentra la primera
 * vez, cuando todavía no sabe qué significa esa campana.
 */
export function AvisosOfertador({ municipios }: { municipios: number }) {
  const [estado, setEstado] = useState<Estado>('cargando')

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

  async function activar() {
    setEstado('trabajando')
    const r = await activarAvisos()
    setEstado(r === 'activado' ? 'activo' : r === 'ios' ? 'ios' : 'error')
  }

  async function apagar() {
    setEstado('trabajando')
    await desactivarAvisos()
    setEstado('inactivo')
  }

  const activo = estado === 'activo'
  const ocupado = estado === 'trabajando' || estado === 'cargando'

  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="font-heading text-2xl">Avisarme cuando alguien pida ayuda</h2>
      <p className="mt-2 text-base text-muted-foreground">
        Te llega un aviso a este teléfono cuando alguien publica una solicitud
        en {municipios === 1 ? 'tu municipio' : 'alguno de tus municipios'}. El
        aviso dice el municipio y la categoría, nunca quién pidió ni qué
        escribió.
      </p>

      {estado === 'ios' && (
        <Alert variant="warning" className="mt-3">
          <Share className="size-5" />
          <AlertDescription>
            En iPhone los avisos solo funcionan si agregas AquíVe a tu pantalla
            de inicio: toca <strong>Compartir</strong> y luego{' '}
            <strong>Agregar a pantalla de inicio</strong>.
          </AlertDescription>
        </Alert>
      )}

      {activo && (
        <Alert className="mt-3">
          <BellRing className="size-5" />
          <AlertDescription>
            Activados en este dispositivo. Puedes apagarlos desde la campana
            del encabezado.
          </AlertDescription>
        </Alert>
      )}

      {estado === 'error' && (
        <p className="mt-3 text-sm text-muted-foreground">
          No pudimos activar los avisos. Puedes seguir mirando el tablero de
          solicitudes cuando quieras.
        </p>
      )}

      <div className="mt-3">
        {activo ? (
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={ocupado}
            onClick={apagar}
          >
            <BellOff className="size-5" aria-hidden="true" />
            Desactivar en este dispositivo
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={ocupado}
            onClick={activar}
          >
            <Bell className="size-5" aria-hidden="true" />
            {estado === 'trabajando' ? 'Activando…' : 'Activar avisos'}
          </Button>
        )}
      </div>
    </section>
  )
}
