'use client'

import { useState, useSyncExternalStore } from 'react'
import { Bell, BellRing, Share } from 'lucide-react'
import { activarAvisosDeSolicitud, enPantallaDeInicio, esIOS } from '@/lib/avisos'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

const sinSuscripcion = () => () => {}
const enCliente = () => true
const enServidor = () => false

type Estado = 'cargando' | 'inicial' | 'activando' | 'activo' | 'ios' | 'error'

/**
 * Los avisos de una solicitud, para quien la publicó.
 *
 * Hasta agosto de 2026 este archivo reimplementaba `claveAplicacion`,
 * `esIOS` y `enPantallaDeInicio` por su cuenta: era un fork literal de
 * `lib/avisos.ts`, así que cualquier arreglo en la librería no llegaba
 * aquí. Ahora la lógica vive en un solo sitio.
 *
 * `destacado` lo pone la pantalla de confirmación, donde esto es lo
 * primero que hay que hacer después de publicar. En «Ajustes» va discreto,
 * porque ahí solo lo busca quien ya lo apagó o cambió de teléfono.
 */
export function ActivarAvisos({
  token,
  destacado = false,
  yaTieneAvisos = false,
}: {
  token: string
  destacado?: boolean
  /**
   * Si ESTA solicitud ya tiene una suscripción, según la base.
   *
   * ⚠ No vale preguntarle a `avisosActivosAqui()`: eso mira el navegador, y
   * un teléfono tiene UNA sola suscripción push. Basta con que exista por
   * el lado de quien ofrece para que parezca que esta solicitud está
   * cubierta cuando no lo está — son dos tablas distintas. Con eso, el
   * ofrecimiento no se dibujaba nunca.
   */
  yaTieneAvisos?: boolean
}) {
  // `navigator` no existe al renderizar en el servidor, así que hasta que
  // no hay hidratación no se puede saber si esto es un iPhone. Mismo patrón
  // que `select-filtro.tsx`, y no un efecto que llame a `setState`: eso
  // dispara un render en cascada y el lint lo rechaza con razón.
  const hidratado = useSyncExternalStore(sinSuscripcion, enCliente, enServidor)
  const [tocado, setTocado] = useState<Estado | null>(null)

  const estado: Estado = tocado
    ? tocado
    : !hidratado
      ? 'cargando'
      : yaTieneAvisos
        ? 'activo'
        : // En iPhone sin pantalla de inicio se dice ANTES, no después de
          // que el intento falle: así no se gasta el único toque que hay.
          esIOS() && !enPantallaDeInicio()
          ? 'ios'
          : 'inicial'

  const setEstado = setTocado

  async function activar() {
    setEstado('activando')
    const r = await activarAvisosDeSolicitud(token)
    setEstado(r === 'activado' ? 'activo' : r === 'ios' ? 'ios' : 'error')
  }

  if (estado === 'cargando') return null

  // Ya activos: en la confirmación desaparece, en ajustes se confirma.
  if (estado === 'activo') {
    if (destacado) return null
    return (
      <Alert>
        <BellRing className="size-5" />
        <AlertDescription>
          Listo. Te avisamos en este teléfono cuando alguien responda.
        </AlertDescription>
      </Alert>
    )
  }

  if (estado === 'ios') {
    return (
      <Alert variant="warning">
        <Share className="size-5" />
        <AlertDescription>
          En iPhone los avisos solo funcionan si agregas AquíVe a tu pantalla
          de inicio: toca <strong>Compartir</strong> y luego{' '}
          <strong>Agregar a pantalla de inicio</strong>. Si prefieres, guarda
          el enlace y vuelve cuando quieras: siempre verás las respuestas ahí.
        </AlertDescription>
      </Alert>
    )
  }

  const boton = (
    <Button
      variant={destacado ? 'default' : 'outline'}
      className="w-full"
      disabled={estado === 'activando'}
      onClick={activar}
    >
      <Bell className="size-5" />
      {estado === 'activando' ? 'Activando…' : 'Avisarme cuando respondan'}
    </Button>
  )

  const error = estado === 'error' && (
    <p className="text-sm text-muted-foreground">
      No pudimos activar los avisos. No pasa nada: guarda tu enlace y vuelve
      cuando quieras para ver las respuestas.
    </p>
  )

  if (!destacado) return <div className="space-y-2">{boton}{error}</div>

  return (
    <div className="rounded-xl border border-primary/30 bg-accent p-4">
      <p className="text-base font-medium text-accent-foreground">
        ¿Te avisamos cuando alguien responda?
      </p>
      <p className="mt-1 text-base text-accent-foreground/80">
        Sin esto tendrías que volver a entrar por tu enlace a mirar. Es un
        toque y no pedimos tu teléfono.
      </p>
      <div className="mt-3 space-y-2">
        {boton}
        {error}
      </div>
    </div>
  )
}
