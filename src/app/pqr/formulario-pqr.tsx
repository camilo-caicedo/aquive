'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy } from 'lucide-react'

import { rpc } from '@/orpc/cliente'
import { MarcoFlujo } from '@/components/marco-flujo'
import { Button } from '@/components/ui/button'
import { CORREO_CONTACTO } from '@/lib/config'
import { contienePII, MENSAJE_PII } from '@/lib/validacion'
import { NOMBRE_TIPO_PQR, PLAZO_HABIL, TipoPqr } from '@/contrato/pqr'

/**
 * Pantalla 38 · Poner una PQR.
 *
 * Flujo, no destino (regla 10): `MarcoFlujo` esconde la barra inferior, así
 * que no hay cuatro salidas a medio llenar mientras se escribe.
 *
 * ⚠ El plazo que se anuncia es el legal —artículos 14 y 15 de la Ley 1581,
 * diez días hábiles una consulta y quince un reclamo— y cambia con el tipo
 * elegido. El prototipo decía «cinco días hábiles» para todo; se descartó.
 * Los dos números nunca se dicen en la misma frase: en pantalla solo se ve
 * el del tipo que la persona escogió.
 *
 * Sin cuenta. Al enviar se muestra el código una vez y no se puede
 * recuperar, porque de él solo se guarda el sha256.
 */
export function FormularioPqr() {
  const [tipo, setTipo] = useState<TipoPqr>('peticion')
  const [asunto, setAsunto] = useState('')
  const [detalle, setDetalle] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState<{ codigo: string; plazo: number } | null>(null)

  // El origen se lee del navegador y no de una variable de entorno: esto es
  // un componente de cliente y ya está donde hay que estar. Antes de hidratar
  // no se pinta nada de esto —solo aparece con `listo` puesto, que es
  // consecuencia de un clic—, así que no hay desajuste posible.
  const origen = typeof window === 'undefined' ? '' : window.location.origin

  const puede =
    asunto.trim().length >= 3 && detalle.trim().length >= 10 && !enviando

  async function enviar() {
    // El mismo filtro que aplica el servidor, aplicado antes: así el aviso
    // sale al lado del campo en vez de después de un viaje de ida y vuelta.
    if (contienePII(asunto) || contienePII(detalle)) {
      setError(MENSAJE_PII)
      return
    }

    setEnviando(true)
    setError(null)
    try {
      const r = await rpc.pqr.crear({
        tipo,
        asunto: asunto.trim(),
        detalle: detalle.trim(),
      })
      setListo({ codigo: r.codigo, plazo: r.plazo_habil })
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo enviar. Inténtalo otra vez.')
    } finally {
      setEnviando(false)
    }
  }

  if (listo) {
    return (
      <MarcoFlujo titulo="Listo" volver="/ayuda">
        <div className="shadow-canto rounded-2xl bg-card p-4">
          <h2 className="font-heading text-2xl">Recibimos tu {NOMBRE_TIPO_PQR[tipo].toLowerCase()}.</h2>
          <p className="mt-2 text-base">
            Guarda este enlace. Es lo que identifica tu caso y por donde vas a
            ver la respuesta, y no lo podemos recuperar: no guardamos quién
            eres.
          </p>
          {/* El enlace, no el código suelto. Antes se entregaba un código
              «para cuando escribas después» y no había ningún después: no
              existía pantalla para consultarla. Un canal de habeas data que
              solo sabe recibir no es un canal. */}
          <p className="mt-3 font-mono text-sm break-all">
            {origen}/pqr/{listo.codigo}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                navigator.clipboard.writeText(`${origen}/pqr/${listo.codigo}`)
              }
            >
              <Copy className="size-4" aria-hidden="true" />
              Copiar el enlace
            </Button>
            <Button
              nativeButton={false}
              render={<Link href={`/pqr/${encodeURIComponent(listo.codigo)}`} />}
            >
              Ver mi {NOMBRE_TIPO_PQR[tipo].toLowerCase()}
            </Button>
          </div>
          <p className="mt-4 text-base text-muted-foreground">
            Respondemos dentro de los {listo.plazo} días hábiles que fija la
            Ley 1581 de 2012. La respuesta aparece en ese enlace. Si lo
            pierdes, escríbenos a {CORREO_CONTACTO}.
          </p>

          <div className="mt-4">
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/ayuda" />}
            >
              Volver a Ayuda
            </Button>
          </div>
        </div>
      </MarcoFlujo>
    )
  }

  return (
    <MarcoFlujo
      titulo="Peticiones, quejas y reclamos"
      volver="/ayuda"
      accion={
        <Button onClick={enviar} disabled={!puede} className="w-full">
          Enviar la {NOMBRE_TIPO_PQR[tipo].toLowerCase()}
        </Button>
      }
    >
      <p className="text-base text-muted-foreground">
        Cuéntanos qué pasó. Respondemos dentro de los {PLAZO_HABIL[tipo]} días
        hábiles que fija la Ley 1581 de 2012 para{' '}
        {tipo === 'queja' || tipo === 'reclamo' ? 'un reclamo' : 'una consulta'}
        . Al enviar te damos un código para seguirla: no hace falta cuenta.
      </p>

      <fieldset className="mt-6">
        <legend className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
          Qué es
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TipoPqr.options.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={`inline-flex min-h-12 items-center rounded-full px-4 text-base transition-colors ${
                tipo === t
                  ? 'bg-foreground font-semibold text-background'
                  : 'shadow-canto bg-card hover:bg-muted'
              }`}
            >
              {NOMBRE_TIPO_PQR[t]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <label
          htmlFor="asunto"
          className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase"
        >
          Asunto
        </label>
        <input
          id="asunto"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          maxLength={140}
          placeholder="Ej. El prestador no llegó a la cita"
          className="bg-card border border-input focus-visible:ring-ring mt-2 min-h-14 w-full rounded-2xl px-4 text-base focus-visible:ring-2 focus-visible:outline-none"
        />
        <p className="mt-1 text-sm text-muted-foreground">{asunto.length}/140</p>
      </div>

      <div className="mt-4">
        <label
          htmlFor="detalle"
          className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase"
        >
          Detalle
        </label>
        <textarea
          id="detalle"
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          maxLength={1000}
          rows={6}
          placeholder="Cuéntanos con fechas lo que ocurrió."
          className="bg-card border border-input focus-visible:ring-ring mt-2 w-full resize-none rounded-2xl px-4 py-3 text-base focus-visible:ring-2 focus-visible:outline-none"
        />
        <p className="mt-1 text-sm text-muted-foreground">{detalle.length}/1000</p>
      </div>

      {/* El aviso de minimización, pegado al campo donde se incumple. */}
      <p className="bg-accent text-accent-foreground mt-4 rounded-xl px-4 py-3 text-base">
        Si vas a nombrar a alguien, usa el código del servicio o de la
        solicitud. No hace falta su teléfono.
      </p>

      {error && (
        <p
          role="alert"
          className="shadow-canto mt-4 rounded-xl bg-card px-4 py-3 text-base"
        >
          {error}
        </p>
      )}
    </MarcoFlujo>
  )
}
