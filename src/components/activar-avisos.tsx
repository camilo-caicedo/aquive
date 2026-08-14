'use client'

import { useState } from 'react'
import { Bell, BellRing, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// base64url → Uint8Array, formato que exige pushManager.subscribe
function claveAplicacion(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const normal = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(normal)
  const salida = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) salida[i] = binario.charCodeAt(i)
  return salida
}

function esIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function enPantallaDeInicio() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

type Estado = 'inicial' | 'activando' | 'activo' | 'ios' | 'error'

export function ActivarAvisos({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>('inicial')

  async function activar() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado(esIOS() ? 'ios' : 'error')
      return
    }
    // En iOS el push solo existe si el sitio está en la pantalla de inicio.
    if (esIOS() && !enPantallaDeInicio()) {
      setEstado('ios')
      return
    }

    setEstado('activando')
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
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
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          endpoint: suscripcion.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      })

      setEstado(res.ok ? 'activo' : 'error')
    } catch {
      setEstado('error')
    }
  }

  if (estado === 'activo') {
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

  return (
    <div className="space-y-2">
      <Button variant="outline" className="w-full" disabled={estado === 'activando'} onClick={activar}>
        <Bell className="size-5" />
        {estado === 'activando' ? 'Activando…' : 'Avisarme cuando respondan'}
      </Button>
      {estado === 'error' && (
        <p className="text-sm text-muted-foreground">
          No pudimos activar los avisos. No pasa nada: guarda tu enlace y
          vuelve cuando quieras para ver las respuestas.
        </p>
      )}
    </div>
  )
}
