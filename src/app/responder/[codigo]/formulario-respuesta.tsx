'use client'

import type { ReactNode } from 'react'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function FormularioRespuesta({
  aviso,
  codigo,
  yaRespondio,
  puedeTrasladarse,
  puedeRecoger,
}: {
  /** El aviso completo de honestidad. Va pegado al botón, no arriba de la
      pantalla: es donde se decide entregar el nombre y el teléfono. */
  aviso?: ReactNode

  codigo: string
  yaRespondio: boolean
  /** Lo que ya dijo en su perfil. Precarga la casilla, no la fija. */
  puedeTrasladarse: boolean
  /** Si quien pidió puede ir a buscarlo. Evita preguntarlo por fuera. */
  puedeRecoger: boolean
}) {
  const router = useRouter()
  const [mensaje, setMensaje] = useState('')
  const [puedeLlevar, setPuedeLlevar] = useState(puedeTrasladarse)
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
        <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/ayudas" />}>
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
        body: JSON.stringify({ codigo, mensaje: texto, puedeLlevar }),
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
        <p className="font-heading mb-1 text-xs tracking-[0.085em] text-muted-foreground uppercase">
          Tu mensaje
        </p>
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

      {/* Viene marcada si ya lo dijo en su perfil, y se puede desmarcar: se
          puede tener carro y no poder ese día. Así la logística deja de ser
          la primera pregunta de cada conversación. */}
      <label className="shadow-canto flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-transparent bg-card p-3 has-checked:border-enlace has-checked:bg-accent has-checked:shadow-none">
        <input
          type="checkbox"
          checked={puedeLlevar}
          onChange={(e) => setPuedeLlevar(e.target.checked)}
          className="mt-0.5 size-6 shrink-0"
        />
        <span>
          <span className="text-base font-medium">Puedo llevarlo al lugar</span>
          <span className="block text-sm text-muted-foreground">
            {puedeRecoger
              ? 'Esta persona dijo que puede ir a recoger, así que quizá no haga falta.'
              : 'Se lo decimos a quien pidió, junto a tu respuesta.'}
          </span>
        </span>
      </label>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {aviso}

      <Button className="w-full" disabled={!puedeEnviar} onClick={enviar}>
        {enviando ? 'Enviando…' : 'Puedo ayudar'}
      </Button>
    </div>
  )
}
