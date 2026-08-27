'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { rpc } from '@/orpc/cliente'
import type { MiSolicitudInsumos } from '@/contrato/insumos'
import type { Categoria } from '@/lib/types'
import { categoria } from '@/lib/catalogo'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useHidratado } from '@/components/hidratado'

/**
 * Las solicitudes de insumos propias.
 *
 * ⚠ Esta lista **no se pintaba en ninguna parte**. `insumos.mias` e
 * `insumos.gestionar` existían en el contrato, en el enrutador y en el
 * dominio desde el ADR 0006, y ninguna pantalla los llamaba: quien publicaba
 * un insumo aterrizaba en `/mis-solicitudes`, que solo leía servicios, y veía
 * «Todavía no has pedido ningún servicio». No podía verlo, ni renovar las 72
 * horas, ni cerrarlo.
 *
 * Gemela de `ListaMias`, la de servicios, con dos diferencias que son del
 * módulo y no del código: aquí el plazo es de 72 horas y la etiqueta de
 * cierre es «Entregada», porque lo que se pide es una cosa y llega o no
 * llega.
 */
export function ListaInsumos({
  solicitudes,
}: {
  solicitudes: MiSolicitudInsumos[]
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Las fechas solo después de hidratar: el servidor va en UTC y el teléfono
  // en la hora de aquí (ADR 0005).
  const hidratado = useHidratado()

  function actuar(id: string, accion: 'renovar' | 'cerrar') {
    setError(null)
    rpc.insumos
      .gestionar({ id, accion })
      .then(() => iniciar(() => router.refresh()))
      .catch((e) => {
        const motivo =
          e && typeof e === 'object' && 'data' in e
            ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
            : null
        setError(motivo ?? 'No se pudo. Inténtalo otra vez.')
      })
  }

  if (solicitudes.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-base text-muted-foreground">
        Todavía no has pedido insumos.
      </p>
    )
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ul className="mt-4 space-y-3">
        {solicitudes.map((s) => {
          const vencida = new Date(s.expira_at) < new Date()
          const abierta = s.estado === 'abierta' && !vencida

          return (
            <li key={s.id} className="shadow-canto rounded-2xl bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                {/* La etiqueta, no el valor de la columna: la pantalla decía
                    «abrigo» en minúscula, que es cómo lo guarda la base y no
                    cómo se llama la categoría. */}
                <h3 className="font-heading text-lg leading-tight">
                  {categoria(s.categoria as Categoria).etiqueta}
                </h3>
                {/* El estado no depende solo del color: lleva su palabra. */}
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${
                    abierta
                      ? 'bg-ok-suave text-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {abierta ? 'Abierta' : vencida ? 'Vencida' : 'Entregada'}
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">{s.barrio}</p>

              {/* El código va en monoespaciada porque se dicta por teléfono,
                  y ahí importa distinguir un cero de una o. */}
              <p className="mt-1 font-mono text-sm text-muted-foreground">{s.codigo}</p>

              {/* Lo único que quien pidió vuelve a mirar. Sin esto la
                  pantalla enseña un código y nada más. */}
              <p
                className={`mt-2 text-base ${
                  s.num_respuestas > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                {s.num_respuestas === 0
                  ? 'Nadie ha respondido todavía.'
                  : s.num_respuestas === 1
                    ? 'Una persona respondió.'
                    : `${s.num_respuestas} personas respondieron.`}
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                {hidratado
                  ? abierta
                    ? `Se borra sola el ${new Date(s.expira_at).toLocaleDateString('es-CO')}.`
                    : 'Ya no aparece para nadie.'
                  : ' '}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={pendiente}
                  onClick={() => actuar(s.id, 'renovar')}
                >
                  {abierta ? 'Renovar 72 horas' : 'Volver a abrirla'}
                </Button>
                {abierta && (
                  <Button
                    variant="ghost"
                    disabled={pendiente}
                    onClick={() => actuar(s.id, 'cerrar')}
                  >
                    Ya me llegó
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
