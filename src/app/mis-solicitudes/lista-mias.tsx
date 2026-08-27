'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { rpc } from '@/orpc/cliente'
import { Button } from '@/components/ui/button'
import type { MiSolicitudServicio } from '@/contrato/servicios'

/**
 * Las solicitudes de servicio propias.
 *
 * ⚠ Esto sustituye a `lista-local.tsx` y `lista-servicios.tsx`, que leían
 * de `localStorage` la lista de tokens de este teléfono. Desde el ADR 0006
 * lo suyo se le pregunta al servidor, y con eso desaparece el fallo que el
 * README tenía abierto —la lista que no siempre aparecía— y el que nadie
 * había escrito: cambiar de teléfono era perderlo todo.
 */
export function ListaMias({ solicitudes }: { solicitudes: MiSolicitudServicio[] }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function actuar(id: string, accion: 'renovar' | 'cerrar') {
    setError(null)
    rpc.servicios
      .gestionarSolicitud({ id, accion })
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
      <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
        Todavía no has pedido ningún servicio.
      </p>
    )
  }

  return (
    <>
      {error && (
        <p className="bg-accent text-accent-foreground mt-4 rounded-2xl p-4 text-base">
          {error}
        </p>
      )}

      <ul className={`mt-4 space-y-3 ${pendiente ? 'opacity-60' : ''} transition-opacity`}>
        {solicitudes.map((s) => {
          const vencida = new Date(s.expira_at) < new Date()
          const abierta = s.estado === 'abierta' && !vencida

          return (
            <li key={s.id} className="shadow-canto rounded-2xl bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-heading text-lg leading-tight">
                  {s.oficio ?? 'Un servicio'}
                </h2>
                {/* El estado no depende solo del color: lleva su palabra. */}
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${
                    abierta
                      ? 'bg-ok-suave text-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {abierta ? 'Abierta' : vencida ? 'Vencida' : 'Cerrada'}
                </span>
              </div>

              {/* El código va en monoespaciada porque se dicta por teléfono,
                  y ahí importa distinguir un cero de una o. */}
              <p className="mt-1 font-mono text-sm text-muted-foreground">{s.codigo}</p>

              <p className="mt-1 text-sm text-muted-foreground">
                {abierta
                  ? `Se borra sola el ${new Date(s.expira_at).toLocaleDateString('es-CO')}.`
                  : 'Ya no aparece para nadie.'}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => actuar(s.id, 'renovar')}>
                  {abierta ? 'Renovar 15 días' : 'Volver a abrirla'}
                </Button>
                {abierta && (
                  <Button variant="ghost" onClick={() => actuar(s.id, 'cerrar')}>
                    Cerrarla
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
