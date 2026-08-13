'use client'

import { useState } from 'react'
import { Bell, BellRing, BellOff, Share } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

function claveAplicacion(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const normal = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(normal)
  const salida = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) salida[i] = binario.charCodeAt(i)
  return salida
}

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const enPantallaDeInicio = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true

type Estado = 'inicial' | 'activando' | 'activo' | 'ios' | 'error' | 'apagado'

export function AvisosOfertador({ municipios }: { municipios: number }) {
  const [estado, setEstado] = useState<Estado>('inicial')

  async function activar() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado(esIOS() ? 'ios' : 'error')
      return
    }
    if (esIOS() && !enPantallaDeInicio()) {
      setEstado('ios')
      return
    }

    setEstado('activando')
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        setEstado('error')
        return
      }
      const registro = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveAplicacion(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      const json = suscripcion.toJSON()

      const supabase = createClient()
      const { error } = await supabase.rpc('guardar_push_ofertador', {
        p_endpoint: suscripcion.endpoint,
        p_p256dh: json.keys?.p256dh ?? '',
        p_auth: json.keys?.auth ?? '',
      })
      setEstado(error ? 'error' : 'activo')
    } catch {
      setEstado('error')
    }
  }

  async function apagar() {
    const supabase = createClient()
    await supabase.rpc('quitar_push_ofertador', {})
    setEstado('apagado')
  }

  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="text-xl font-bold">Avisarme cuando alguien pida ayuda</h2>
      <p className="mt-2 text-base text-muted-foreground">
        Te llega un aviso a este teléfono cuando alguien publica una solicitud
        en {municipios === 1 ? 'tu municipio' : 'alguno de tus municipios'}. El
        aviso dice el municipio y la categoría, nunca quién pidió ni qué
        escribió.
      </p>

      {estado === 'ios' && (
        <Alert variant="warning" className="mt-3">
          <Share className="size-5" />
          <AlertDescription className="text-amber-900">
            En iPhone los avisos solo funcionan si agregas AquíVe a tu pantalla
            de inicio: toca <strong>Compartir</strong> y luego{' '}
            <strong>Agregar a pantalla de inicio</strong>.
          </AlertDescription>
        </Alert>
      )}

      {estado === 'activo' && (
        <Alert className="mt-3">
          <BellRing className="size-5" />
          <AlertDescription>
            Listo. Te avisamos cuando alguien pida ayuda cerca.
          </AlertDescription>
        </Alert>
      )}

      {estado === 'apagado' && (
        <Alert className="mt-3">
          <BellOff className="size-5" />
          <AlertDescription>Avisos desactivados en todos tus teléfonos.</AlertDescription>
        </Alert>
      )}

      {estado === 'error' && (
        <p className="mt-3 text-sm text-muted-foreground">
          No pudimos activar los avisos. Puedes seguir mirando el tablero de
          solicitudes cuando quieras.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          disabled={estado === 'activando'}
          onClick={activar}
        >
          <Bell className="size-5" aria-hidden="true" />
          {estado === 'activando' ? 'Activando…' : 'Activar avisos'}
        </Button>
        <Button variant="ghost" className="w-full sm:w-auto" onClick={apagar}>
          <BellOff className="size-5" aria-hidden="true" />
          Desactivar
        </Button>
      </div>
    </section>
  )
}
