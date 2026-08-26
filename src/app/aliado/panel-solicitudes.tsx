'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PackageCheck, Users } from 'lucide-react'
import { validarMensaje } from '@/lib/validacion'
import { describirItem } from '@/lib/catalogo'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { SolicitudPorAtender } from '@/lib/types'

/**
 * Lo que la fundación puede entregar de su propia bodega.
 *
 * Faltaba este caso entero: una organización que YA TIENE lo que alguien
 * pidió tenía que esperar a que apareciera un ofertador, porque toda
 * entrega colgaba de una conversación con uno.
 *
 * No hay cruce automático y no lo va a haber: no existe inventario de
 * organizaciones, y uno que alguien tiene que mantener al día es un cruce
 * que miente en cuanto se descuida. Aquí se ve lo que se pidió y la
 * fundación decide mirando su bodega.
 *
 * El filtro que importa está en SQL: `solicitudes_de_mi_organizacion` solo
 * devuelve solicitudes con `flujo = 'acompanado'` de la propia
 * organización. Sin eso el botón arrastraría a alguien del Flujo 1, que
 * nunca aceptó nada.
 */
export function PanelSolicitudes({ solicitudes }: { solicitudes: SolicitudPorAtender[] }) {
  const router = useRouter()
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function abrir(s: SolicitudPorAtender) {
    const problema = validarMensaje(mensaje)
    if (problema || mensaje.trim().length < 10) {
      setError(problema ?? 'Escribe al menos una línea diciendo qué van a entregar.')
      return
    }

    setEnviando(true)
    setError(null)

    // Por la ruta y no por la RPC directa: hay que avisarle por push a
    // quien pidió, y las suscripciones no son legibles para el navegador.
    const respuesta = await fetch('/api/invitaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicitudId: s.solicitud_id, mensaje: mensaje.trim() }),
    })

    if (!respuesta.ok) {
      const { error: mensajeError } = await respuesta.json().catch(() => ({ error: null }))
      setError(mensajeError ?? 'No pudimos abrir la conversación.')
      setEnviando(false)
      return
    }

    setAbriendo(null)
    setMensaje('')
    setEnviando(false)
    router.refresh()
  }

  if (solicitudes.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-base text-muted-foreground">
        No hay solicitudes pendientes de tu organización. Aparecen cuando
        alguien de tus municipios pide que la acompañen.
      </p>
    )
  }

  return (
    <ul className="mt-3 space-y-3">
      {solicitudes.map((s) => (
        <li key={s.solicitud_id} className="rounded-2xl bg-card p-4 shadow-canto">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-lg font-bold">{s.codigo}</span>
            {s.hilos > 0 && (
              // Que alguien más ya lo esté trayendo cambia la decisión: no
              // hay por qué mandar dos veces lo mismo al mismo sitio.
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="size-4" aria-hidden="true" />
                {s.hilos === 1 ? 'Ya hay 1 conversación' : `Ya hay ${s.hilos} conversaciones`}
              </span>
            )}
          </div>

          <p className="mt-1 text-base text-muted-foreground">
            {s.municipio} — {s.barrio}
          </p>

          <ul className="mt-2 space-y-1">
            {s.pendientes.map((p, i) => (
              <li key={i} className="text-base">
                {describirItem(p)}
              </li>
            ))}
          </ul>

          {s.nota && <p className="mt-2 text-base text-muted-foreground">«{s.nota}»</p>}

          {s.puede_recoger && (
            <p className="mt-2 text-base text-foreground">Puede ir a recoger al acopio.</p>
          )}

          {abriendo === s.solicitud_id ? (
            <div className="mt-3 space-y-2">
              <Textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                maxLength={1000}
                rows={3}
                aria-label="Primer mensaje"
                placeholder="Ej: Tenemos el agua y el arroz en la bodega. Puedes pasar por el acopio en horario de atención."
              />
              <p className="text-base text-muted-foreground">
                Este mensaje lo va a leer quien pidió. No pongas teléfonos ni
                direcciones que no sean las del acopio.
              </p>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setAbriendo(null)
                    setError(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button className="flex-1" disabled={enviando} onClick={() => abrir(s)}>
                  {enviando ? 'Abriendo…' : 'Enviar'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => {
                setAbriendo(s.solicitud_id)
                setMensaje('')
                setError(null)
              }}
            >
              <PackageCheck className="size-5" aria-hidden="true" />
              Lo entregamos nosotros
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
