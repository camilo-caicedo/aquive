'use client'

import { useState } from 'react'
import { Copy, KeyRound } from 'lucide-react'

import { rpc } from '@/orpc/cliente'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useHidratado } from '@/components/hidratado'

interface Cuenta {
  perfil_id: string
  nombre_visible: string
  tipo: string
  creado_at: string
  usado_at: string | null
}

/**
 * Las cuentas creadas por un admin, y el botón de darle otro enlace.
 *
 * ⚠ Ni la lista ni el botón existían. La pantalla prometía «ese es el botón
 * para cuando lo pierde o se lo quitan» y no había ningún botón, ni forma de
 * encontrar a la persona: `cuentas.regenerar` estaba en el contrato y no lo
 * llamaba nadie. Quien perdía su enlace —la única llave de quien no tiene
 * Google (ADR 0006)— quedaba fuera para siempre.
 *
 * El enlace nuevo se enseña UNA vez y deja el anterior sin servir. Se dice
 * antes de pulsar, no después.
 */
export function ListaCuentas({ cuentas }: { cuentas: Cuenta[] }) {
  const [nuevo, setNuevo] = useState<{ nombre: string; url: string } | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Las fechas solo después de hidratar: el servidor va en UTC y el
  // navegador en la hora de aquí (ADR 0005).
  const hidratado = useHidratado()
  const origen = typeof window === 'undefined' ? '' : window.location.origin

  async function regenerar(perfilId: string, nombre: string) {
    setOcupado(true)
    setError(null)
    try {
      const { codigo } = await rpc.cuentas.regenerar({ perfil_id: perfilId })
      setNuevo({ nombre, url: `${origen}/entrar/${encodeURIComponent(codigo)}` })
      setConfirmando(null)
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo. Inténtalo otra vez.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="mt-8">
      <h2 className="font-heading text-2xl">Cuentas creadas</h2>
      <p className="mt-1 text-base text-muted-foreground">
        {cuentas.length === 0
          ? 'Todavía no has dado de alta a nadie.'
          : 'De su enlace solo se guarda una huella: no se puede volver a ver, solo dar uno nuevo.'}
      </p>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {nuevo && (
        <div className="shadow-canto mt-3 rounded-2xl bg-card p-4">
          <p className="text-base font-semibold">
            Enlace nuevo de {nuevo.nombre}. El anterior ya no sirve.
          </p>
          <p className="mt-2 font-mono text-sm break-all">{nuevo.url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => navigator.clipboard.writeText(nuevo.url)}>
              <Copy className="size-4" aria-hidden="true" />
              Copiar
            </Button>
            <Button variant="ghost" onClick={() => setNuevo(null)}>
              Ya lo entregué
            </Button>
          </div>
        </div>
      )}

      {cuentas.length > 0 && (
        <ul className="mt-3 space-y-3">
          {cuentas.map((c) => (
            <li key={c.perfil_id} className="shadow-canto rounded-2xl bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-heading text-lg leading-tight">
                  {c.nombre_visible}
                </span>
                {/* El estado no depende solo del color: lleva su palabra. */}
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${
                    c.usado_at
                      ? 'bg-ok-suave text-foreground'
                      : 'bg-accent text-accent-foreground'
                  }`}
                >
                  {c.usado_at ? 'Ha entrado' : 'Nunca ha entrado'}
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {hidratado
                  ? `Dada de alta el ${new Date(c.creado_at).toLocaleDateString('es-CO')}${
                      c.usado_at
                        ? ` · última entrada el ${new Date(c.usado_at).toLocaleDateString('es-CO')}`
                        : ''
                    }`
                  : ' '}
              </p>

              <div className="mt-3">
                {confirmando === c.perfil_id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      disabled={ocupado}
                      onClick={() => regenerar(c.perfil_id, c.nombre_visible)}
                    >
                      Sí, dar uno nuevo
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmando(null)}>
                      Cancelar
                    </Button>
                    <p className="w-full text-base text-muted-foreground">
                      El enlace que tenga esa persona hoy deja de servir.
                    </p>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setConfirmando(c.perfil_id)}>
                    <KeyRound className="size-4" aria-hidden="true" />
                    Dar un enlace nuevo
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
