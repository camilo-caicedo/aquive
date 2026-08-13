'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

type Estado = 'inicial' | 'trabajando' | 'renovada' | 'confirmando' | 'cerrada' | 'error'

function olvidarLocalmente(token: string) {
  try {
    const crudo = localStorage.getItem('mis_solicitudes')
    if (!crudo) return
    const lista = JSON.parse(crudo) as Array<{ token: string }>
    localStorage.setItem('mis_solicitudes', JSON.stringify(lista.filter((s) => s.token !== token)))
  } catch {
    // Si localStorage falla, la solicitud igual ya se borró del servidor.
  }
}

export function GestionSolicitud({ token }: { token: string }) {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('inicial')

  async function llamar(accion: 'renovar' | 'cerrar') {
    setEstado('trabajando')
    try {
      const res = await fetch('/api/solicitudes/gestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accion, cumplida: true }),
      })
      if (!res.ok) {
        setEstado('error')
        return
      }
      if (accion === 'cerrar') {
        olvidarLocalmente(token)
        setEstado('cerrada')
      } else {
        setEstado('renovada')
        router.refresh()
      }
    } catch {
      setEstado('error')
    }
  }

  if (estado === 'cerrada') {
    return (
      <Alert className="mt-3">
        <CheckCircle2 className="size-5" />
        <AlertDescription>
          Listo, y gracias por avisar. Tu solicitud y todas sus respuestas se
          borraron de forma definitiva de nuestra base de datos. Solo queda un
          dato anónimo —municipio, categoría y cuánto tardó— que no permite
          identificar a nadie.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {estado === 'renovada' && (
        <Alert>
          <AlertDescription>Listo, tu solicitud dura 72 horas más.</AlertDescription>
        </Alert>
      )}
      {estado === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>No se pudo completar. Intenta de nuevo.</AlertDescription>
        </Alert>
      )}

      <Button
        variant="outline"
        className="w-full"
        disabled={estado === 'trabajando'}
        onClick={() => llamar('renovar')}
      >
        <RefreshCw className="size-5" aria-hidden="true" />
        Sigo necesitando esto (72 horas más)
      </Button>

      {estado === 'confirmando' ? (
        <div className="rounded-lg border-2 border-primary p-3">
          <p className="text-base">
            Al confirmar, tu solicitud y sus respuestas se borran para siempre.
            No se pueden recuperar.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEstado('inicial')}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={estado !== 'confirmando'}
              onClick={() => llamar('cerrar')}
            >
              Sí, borrar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="w-full"
          disabled={estado === 'trabajando'}
          onClick={() => setEstado('confirmando')}
        >
          <CheckCircle2 className="size-5" aria-hidden="true" />
          Ya me ayudaron
        </Button>
      )}
    </div>
  )
}
