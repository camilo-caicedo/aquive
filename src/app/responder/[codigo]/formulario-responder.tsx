'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Info } from 'lucide-react'

import { rpc } from '@/orpc/cliente'
import { validarNota } from '@/lib/validacion'
import type { SolicitudParaResponder } from '@/contrato/insumos'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

/**
 * El formulario de «Yo puedo ayudar».
 *
 * Enseña QUÉ se pidió antes de pedir nada: quien llega desde el tablero ya
 * lo leyó, pero quien llega desde un aviso no, y comprometerse a algo que no
 * se ha visto es cómo se acumulan las respuestas que nadie cumple.
 *
 * ⚠ El teléfono no se escribe aquí. Va el del perfil, que esa persona ya
 * autorizó a publicar: pedirlo otra vez en cada respuesta sería recoger el
 * mismo dato dos veces y dejarlo en un campo libre, que es por donde se
 * cuela lo que el filtro tiene que rechazar.
 */
export function FormularioResponder({
  solicitud,
}: {
  solicitud: SolicitudParaResponder
}) {
  const [mensaje, setMensaje] = useState('')
  const [puedeLlevar, setPuedeLlevar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  const errorMensaje = mensaje.trim().length >= 5 ? validarNota(mensaje.trim()) : null
  const puede = mensaje.trim().length >= 5 && !errorMensaje && !enviando

  async function enviar() {
    if (!puede) return
    setEnviando(true)
    setError(null)
    try {
      await rpc.insumos.responder({
        codigo: solicitud.codigo,
        mensaje: mensaje.trim(),
        puede_llevar: puedeLlevar,
      })
      setListo(true)
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
      <Alert>
        <AlertTitle className="font-heading text-2xl font-extrabold tracking-tight">
          Listo. Tu respuesta salió.
        </AlertTitle>
        <AlertDescription>
          <p className="mt-2 text-base">
            Quien pidió la {solicitud.codigo} ve tu mensaje y tu teléfono, y
            decide si te escribe. No tienes que hacer nada más.
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            Si te escriben y quedan de acuerdo, la entrega es entre ustedes:
            AquíVe no la transporta ni la coordina.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/ayudas" />}>
              Ver otras solicitudes
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (solicitud.ya_respondi) {
    return (
      <Alert>
        <AlertTitle className="font-heading text-2xl">Ya respondiste esta</AlertTitle>
        <AlertDescription>
          <p className="mt-2 text-base">
            Una respuesta por persona y solicitud. Quien pidió ya tiene la tuya
            con tu teléfono.
          </p>
          <div className="mt-3">
            <Button nativeButton={false} render={<Link href="/ayudas" />}>
              Ver otras solicitudes
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-5">
      {/* Qué se pidió, antes de pedir nada. */}
      <section className="shadow-canto rounded-2xl bg-card p-4">
        <h2 className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
          Lo que están pidiendo
        </h2>
        <ul className="mt-2 space-y-1">
          {solicitud.items.map((i) => (
            <li key={i.nombre} className="text-base">
              <span className="font-semibold">{i.cantidad}</span> {i.unidad} ·{' '}
              {i.nombre}
            </li>
          ))}
        </ul>
        {solicitud.nota && (
          <p className="bg-secondary mt-3 rounded-xl p-3 text-base">{solicitud.nota}</p>
        )}
        {solicitud.puede_recoger && (
          <p className="mt-2 text-base text-muted-foreground">
            Puede recogerlo: no hace falta que se lo lleves.
          </p>
        )}
      </section>

      <div>
        <Label htmlFor="mensaje">Qué puedes dar, y cuándo</Label>
        <Textarea
          id="mensaje"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={200}
          rows={4}
          className="mt-1"
          placeholder="Tengo dos cobijas y un mercado pequeño. Puedo mañana en la tarde."
        />
        <p className="mt-1 text-sm text-muted-foreground">
          {mensaje.trim().length}/200. No escribas tu teléfono aquí: va el de tu
          perfil, y lo verá solo quien pidió.
        </p>
        {errorMensaje && <p className="mt-1 text-sm text-destructive">{errorMensaje}</p>}
      </div>

      <label className="flex min-h-12 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={puedeLlevar}
          onChange={(e) => setPuedeLlevar(e.target.checked)}
          className="mt-1 size-5 shrink-0"
        />
        <span className="text-base">
          Puedo llevarlo hasta donde esté
          <span className="block text-sm text-muted-foreground">
            Si no lo marcas, se entiende que hay que recogerlo donde tú estés.
          </span>
        </span>
      </label>

      <p className="flex items-start gap-1.5 text-base text-muted-foreground">
        <Info className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
        <span>
          Con tu respuesta va el teléfono público de tu perfil. Quien pidió
          decide si te escribe; tú no ves ningún dato suyo.
        </span>
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button className="w-full" disabled={!puede} onClick={enviar}>
        <Check className="size-5" aria-hidden="true" />
        {enviando ? 'Enviando…' : 'Enviar mi respuesta'}
      </Button>
    </div>
  )
}
