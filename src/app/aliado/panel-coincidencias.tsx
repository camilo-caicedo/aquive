'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { validarMensaje } from '@/lib/validacion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Coincidencia } from '@/lib/types'

/**
 * Quién tiene justo lo que pide una solicitud acompañada de nuestros
 * municipios. Es el mismo cruce del tablero, visto desde el otro lado.
 *
 * El filtro que importa está en SQL, no aquí: `coincidencias_para_aliado`
 * solo devuelve solicitudes con `flujo = 'acompanado'`. Sin eso el panel
 * mostraría solicitudes anónimas del Flujo 1 y el botón arrastraría a
 * alguien que nunca aceptó nada a un hilo interno.
 */
export function PanelCoincidencias({ coincidencias }: { coincidencias: Coincidencia[] }) {
  const router = useRouter()
  const [invitando, setInvitando] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function invitar(c: Coincidencia) {
    const problema = validarMensaje(mensaje)
    if (problema || mensaje.trim().length < 10) {
      setError(problema ?? 'Escribe al menos una línea explicando para qué lo buscas.')
      return
    }

    setEnviando(true)
    setError(null)

    // Por la ruta y no por la RPC directa: a quien invitan hay que
    // avisarle por push, y no tiene por qué estar mirando la pantalla.
    const respuesta = await fetch('/api/invitaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        solicitudId: c.solicitud_id,
        ofertadorId: c.ofertador_id,
        mensaje: mensaje.trim(),
      }),
    })

    if (!respuesta.ok) {
      const { error: mensajeError } = await respuesta.json().catch(() => ({ error: null }))
      setError(mensajeError ?? 'No pudimos enviar la invitación.')
      setEnviando(false)
      return
    }

    setInvitando(null)
    setMensaje('')
    setEnviando(false)
    router.refresh()
  }

  if (coincidencias.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-base text-muted-foreground">
        No hay coincidencias por ahora. Aparecen cuando alguien de tus
        municipios declara tener justo lo que pide una solicitud acompañada.
      </p>
    )
  }

  return (
    <ul className="mt-3 space-y-3">
      {coincidencias.map((c) => {
        const clave = `${c.solicitud_id}-${c.ofertador_id}`
        return (
          <li key={clave} className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-lg font-bold">{c.codigo}</span>
              <span className="text-base text-muted-foreground">{c.municipio}</span>
            </div>

            {/* Dos fuentes, la misma tarjeta: el cruce por inventario trae
                ítems, y quien ya se ofreció trae lo que escribió. */}
            {c.mensaje ? (
              <>
                <p className="mt-1 text-base">{c.ofertador} respondió esta solicitud</p>
                <p className="mt-2 text-base text-muted-foreground">{c.mensaje}</p>
              </>
            ) : (
              <>
                <p className="mt-1 text-base">
                  {c.ofertador} tiene {c.items_coincidentes}{' '}
                  {c.items_coincidentes === 1 ? 'cosa' : 'cosas'} de las que piden
                </p>

                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {c.detalle.map((d, i) => (
                    <li
                      key={i}
                      className="rounded-full bg-muted px-3.5 py-1.5 text-sm text-foreground"
                    >
                      {d.cantidad} {d.unidad} de {d.nombre}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {c.ya_hay_hilo ? (
              <p className="mt-3 text-base text-ok">Ya están en conversación</p>
            ) : invitando === clave ? (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Cuéntale para qué lo buscas y cómo sería la entrega en el acopio."
                  aria-label="Mensaje de la invitación"
                />
                <p className="text-sm text-muted-foreground">
                  Este mensaje va firmado por ti, no por quien ofrece. Se abre
                  la conversación con los tres dentro.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button disabled={enviando} onClick={() => invitar(c)}>
                    {enviando ? 'Abriendo…' : 'Abrir la conversación'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={enviando}
                    onClick={() => {
                      setInvitando(null)
                      setError(null)
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => {
                  setInvitando(clave)
                  setMensaje('')
                  setError(null)
                }}
              >
                Invitar a coordinar
              </Button>
            )}

            {error && invitando === clave && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </li>
        )
      })}
    </ul>
  )
}
