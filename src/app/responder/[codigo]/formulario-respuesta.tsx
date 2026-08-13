'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function FormularioRespuesta({
  codigo,
  yaRespondio,
}: {
  codigo: string
  yaRespondio: boolean
}) {
  const router = useRouter()
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (yaRespondio || enviado) {
    return (
      <div className="mt-4 space-y-4">
        <Alert>
          <AlertDescription>
            Ya respondiste esta solicitud. Si esa persona quiere tu ayuda, te
            escribirá al contacto de tu perfil.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/" />}>
          Ver otras solicitudes
        </Button>
      </div>
    )
  }

  async function enviar() {
    const texto = mensaje.trim()
    if (texto.length < 5 || texto.length > 200 || enviando) return
    setEnviando(true)
    setError(null)

    try {
      const res = await fetch('/api/respuestas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, mensaje: texto }),
      })
      const data = (await res.json()) as { ok?: true; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'No se pudo enviar la respuesta')
        setEnviando(false)
        return
      }
    } catch {
      setError('No hay conexión. Intenta de nuevo.')
      setEnviando(false)
      return
    }

    setEnviado(true)
    router.refresh()
  }

  const largo = mensaje.trim().length
  const puedeEnviar = largo >= 5 && largo <= 200 && !enviando

  return (
    <div className="mt-4 space-y-4">
      <div>
        <Label htmlFor="mensaje" className="mb-1">
          ¿Qué puedes aportar? (máx. 200 caracteres)
        </Label>
        <Textarea
          id="mensaje"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={200}
          rows={4}
          placeholder="Ej: Tengo 6 litros de agua y 2 libras de arroz, puedo entregarlos mañana en la mañana"
        />
        <p className="mt-1 text-sm text-muted-foreground">{mensaje.length}/200</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button className="w-full" disabled={!puedeEnviar} onClick={enviar}>
        {enviando ? 'Enviando…' : 'Puedo ayudar'}
      </Button>
    </div>
  )
}
