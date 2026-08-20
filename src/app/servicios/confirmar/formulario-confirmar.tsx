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
  { clave: 'cumplimiento', etiqueta: '¿Hizo lo que dijo que iba a hacer?' },
  { clave: 'trato', etiqueta: '¿Cómo te trató?' },
  { clave: 'puntualidad', etiqueta: '¿Llegó y entregó a tiempo?' },
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
        <AlertTitle className="font-heading text-2xl">Gracias</AlertTitle>
        <AlertDescription>
          <p className="mt-2 text-base">
            Tu calificación ya aparece en la ficha de {listo.nombre}, y ese
            servicio quedó contado entre los suyos.
          </p>
          <Button
            className="mt-3"
            nativeButton={false}
            render={<Link href={`/servicios/${listo.id}`} />}
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
        <Label htmlFor="codigo">El código que te dieron</Label>
        <Input
          id="codigo"
          value={codigo}
          // ⚠ El tope son OCHO caracteres útiles, no veinte de `maxLength`:
          // se limpia y se corta al escribir, así que pegar un enlace entero
          // o seguir tecleando no pasa del octavo. Se vuelve a componer con
          // un espacio en medio —«ABCD 2345»— porque es como está impreso en
          // el papel del que se copia.
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
          // Monoespaciada y grande: se copia de un papel, carácter por
          // carácter, y así se distingue lo que se lleva escrito.
          // Grande y monoespaciada porque se copia de un papel carácter por
          // carácter; alineada a la izquierda y no centrada, para que al
          // escribir el cursor no salte de sitio en cada letra.
          className="mt-1 h-16 border-primary/40 px-5 font-mono text-2xl tracking-[0.2em] uppercase"
        />
        {/* Se dice al escribir cuántos faltan. Antes el botón se quedaba
            apagado sin explicar por qué, y desde un papel mal fotocopiado
            eso es un callejón sin salida.

            Lo que no se puede es decir de quién es el código antes de
            enviarlo: no hay ninguna función que lo resuelva sin gastarlo, y
            una consulta abierta por código sería una forma de sondear
            códigos ajenos. */}
        <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
          {!codigoEmpezado
            ? 'Ocho letras y números. No necesitas cuenta, y cada código sirve una sola vez.'
            : codigoCompleto
              ? 'Listo. Al enviar se confirma el servicio de quien te dio este código.'
              : `Llevas ${codigoLimpio.length} de 8.`}
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
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'bg-card shadow-sm hover:bg-muted'
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
          ¿Algo más?{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="comentario"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          maxLength={140}
          rows={3}
          className="mt-1"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          {comentario.length}/140. Lo puede leer cualquiera, y esa persona puede
          responderte en público.
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
