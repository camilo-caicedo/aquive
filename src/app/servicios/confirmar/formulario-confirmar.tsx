'use client'

import { useState } from 'react'
import Link from 'next/link'
import { contienePII } from '@/lib/validacion'
import { TurnstileWidget } from '@/components/turnstile-widget'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const CRITERIOS = [
  { clave: 'cumplimiento', etiqueta: '¿El trabajo se realizó según lo acordado?' },
  { clave: 'trato', etiqueta: '¿Cómo fue la atención y el trato recibido?' },
  { clave: 'puntualidad', etiqueta: '¿Cumplió con los tiempos pactados?' },
] as const

const NIVELES = [
  { valor: 1, etiqueta: 'Mal' },
  { valor: 2, etiqueta: 'Bien' },
  { valor: 3, etiqueta: 'Muy bien' },
] as const

type Criterio = (typeof CRITERIOS)[number]['clave']

export function FormularioConfirmar({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [codigo, setCodigo] = useState('')
  // Normalizado igual que en la base: sin espacios y en mayúsculas. Lo que
  // se escribe a mano viene de un papel, y ahí caben guiones y espacios.
  const codigoLimpio = codigo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const codigoCompleto = codigoLimpio.length === 8
  const codigoEmpezado = codigoLimpio.length > 0
  const [notas, setNotas] = useState<Record<Criterio, number | null>>({
    cumplimiento: null,
    trato: null,
    puntualidad: null,
  })
  const [comentario, setComentario] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState<{ id: string; nombre: string } | null>(null)

  const errorComentario =
    comentario.trim() && contienePII(comentario)
      ? 'El comentario no puede llevar teléfonos ni correos.'
      : null

  const completo =
    codigo.trim().length >= 6 &&
    notas.cumplimiento !== null &&
    notas.trato !== null &&
    notas.puntualidad !== null &&
    !errorComentario &&
    (!turnstileSiteKey || !!turnstileToken)

  async function enviar() {
    setEnviando(true)
    setError(null)

    const respuesta = await fetch('/api/servicios/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo: codigo.trim(),
        cumplimiento: notas.cumplimiento,
        trato: notas.trato,
        puntualidad: notas.puntualidad,
        comentario: comentario.trim() || null,
        turnstileToken,
      }),
    })

    const datos = await respuesta.json()
    setEnviando(false)

    if (!respuesta.ok) {
      setError(datos.error ?? 'No se pudo enviar')
      return
    }

    setListo({ id: datos.proveedor_id, nombre: datos.proveedor_nombre })
  }

  if (listo) {
    return (
      <Alert className="mt-6">
        <AlertTitle className="font-heading text-2xl font-extrabold tracking-tight">Gracias</AlertTitle>
        <AlertDescription>
          <p className="mt-2 text-base">
            Tu calificación ya aparece en la ficha de {listo.nombre}, y ese
            servicio quedó contado entre los suyos.
          </p>
          <Button
            className="mt-3"
            nativeButton={false}
            render={<Link href={`/prestador/${listo.id}`} />}
          >
            Ver su ficha
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mt-6 space-y-6">
      <div>
        <Label htmlFor="codigo">Código del servicio</Label>
        <Input
          id="codigo"
          value={codigo}
          onChange={(e) => {
            const limpio = e.target.value
              .replace(/[^a-zA-Z0-9]/g, '')
              .toUpperCase()
              .slice(0, 8)
            setCodigo(limpio.length > 4 ? `${limpio.slice(0, 4)} ${limpio.slice(4)}` : limpio)
          }}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="ABCD 2345"
          className="mt-1 h-16 border-enlace/40 px-5 font-mono text-2xl tracking-[0.2em] uppercase"
        />
        <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
          {!codigoEmpezado
            ? 'Son 8 letras y números. Cada código sirve una sola vez para confirmar que el trabajo se realizó.'
            : codigoCompleto
              ? 'Listo. Al enviar se confirmará el servicio de quien te dio este código.'
              : `Llevas ${codigoLimpio.length} de 8 caracteres.`}
        </p>
      </div>

      {CRITERIOS.map((c) => (
        <fieldset key={c.clave}>
          <legend className="mb-2 text-base font-medium">{c.etiqueta}</legend>
          <div className="flex flex-wrap gap-2">
            {NIVELES.map((n) => (
              <button
                key={n.valor}
                type="button"
                aria-pressed={notas[c.clave] === n.valor}
                onClick={() => setNotas((p) => ({ ...p, [c.clave]: n.valor }))}
                className={`inline-flex min-h-14 flex-1 items-center justify-center rounded-full px-3 text-base transition-colors ${
                  notas[c.clave] === n.valor
                    ? 'bg-foreground font-semibold text-background'
                    : 'bg-card shadow-canto hover:bg-muted'
                }`}
              >
                {n.etiqueta}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <div>
        <Label htmlFor="comentario">
          Comentario o recomendación{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="comentario"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          maxLength={140}
          rows={3}
          placeholder="Cuéntanos cómo fue tu experiencia..."
          className="mt-1"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          {comentario.length}/140. Tu opinión es pública y ayuda a que otros vecinos confíen en su trabajo.
        </p>
        {errorComentario && (
          <p className="mt-1 text-sm text-destructive">{errorComentario}</p>
        )}
      </div>

      {turnstileSiteKey && (
        <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Fijo abajo: las tres preguntas más el código no caben en una
          pantalla, y el botón quedaba al final de un rollo. */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <Button className="w-full" onClick={enviar} disabled={!completo || enviando}>
          {enviando ? 'Enviando…' : 'Enviar calificación'}
        </Button>
      </div>
    </div>
  )
}
