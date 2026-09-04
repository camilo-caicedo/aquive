'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Clock, MinusCircle, XCircle, type LucideIcon } from 'lucide-react'

import { rpc } from '@/orpc/cliente'
import { Button } from '@/components/ui/button'
import { BotonChat } from '@/components/boton-chat'
import { NOMBRE_GRUPO, type EstadoSolicitud, type MiSolicitudServicio } from '@/contrato/servicios'
import { useAviso } from '@/components/avisos'

/**
 * El estado en palabras Y en icono, nunca solo en color (accesibilidad de
 * CLAUDE.md). Un punto de color no le dice nada a quien no distingue el
 * verde del rojo, y aquí es justo lo único que cambia entre una orden que
 * sigue viva y una que ya se cerró.
 */
const ESTADOS: Record<EstadoSolicitud, { etiqueta: string; clase: string; Icono: LucideIcon }> = {
  pendiente: { etiqueta: 'Pendiente', clase: 'bg-accent text-accent-foreground', Icono: Clock },
  aceptada: { etiqueta: 'Aceptada', clase: 'bg-ok-suave text-foreground', Icono: CheckCircle2 },
  realizada: {
    etiqueta: 'Realizada',
    clase: 'bg-ok-suave text-foreground',
    Icono: CheckCircle2,
  },
  rechazada: {
    etiqueta: 'Rechazada',
    clase: 'bg-destructive/10 text-destructive',
    Icono: XCircle,
  },
  no_concretada: {
    etiqueta: 'No concretada',
    clase: 'bg-secondary text-secondary-foreground',
    Icono: MinusCircle,
  },
}

/**
 * Las solicitudes de servicio propias: cada una es una orden dirigida a un
 * prestador (ADR 0015), con el estado en que va y sus acciones.
 *
 * ⚠ Esto sustituye a `lista-local.tsx` y `lista-servicios.tsx`, que leían
 * de `localStorage` la lista de tokens de este teléfono. Desde el ADR 0006
 * lo suyo se le pregunta al servidor.
 */
export function ListaMias({ solicitudes }: { solicitudes: MiSolicitudServicio[] }) {
  const router = useRouter()
  const avisar = useAviso()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function actuar(id: string, accion: 'renovar' | 'cancelar') {
    setError(null)
    rpc.servicios
      .gestionarSolicitud({ id, accion })
      .then(() => {
        avisar(accion === 'renovar' ? 'Renovada 15 días' : 'Pedido cancelado')
        iniciar(() => router.refresh())
      })
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
        Todavía no le has pedido nada a nadie.
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
          const { etiqueta, clase, Icono } = ESTADOS[s.estado]

          return (
            <li key={s.id} className="shadow-canto rounded-2xl bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                {/* La subcategoría titula desde el ADR 0013; el detalle
                    baja. Las anteriores al ADR no la tienen y se siguen
                    titulando con lo que su dueño escribió. */}
                <h2 className="font-heading text-lg leading-tight">
                  {s.subcategoria ?? s.detalle}
                </h2>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${clase}`}
                >
                  <Icono className="size-4" aria-hidden="true" />
                  {etiqueta}
                </span>
              </div>

              {/* Que nadie la ha mirado todavía. Va con la palabra, no
                  con un color (regla de interfaz 9). */}
              {s.subcategoria_en_revision && (
                <p className="font-heading mt-1 inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs tracking-[0.085em] text-accent-foreground uppercase">
                  Lo estamos revisando
                </p>
              )}

              {/* A quién se le pidió, y la categoría al lado: lo que se
                  busca en la lista propia es cuál de las mías es. */}
              <p className="mt-1 text-sm text-muted-foreground">
                {s.proveedor_nombre ?? 'Ese prestador ya no tiene ficha'} ·{' '}
                {NOMBRE_GRUPO[s.grupo] ?? s.grupo}
              </p>

              {s.subcategoria && s.detalle && (
                <p className="mt-1 text-base">{s.detalle}</p>
              )}

              {/* El código va en monoespaciada porque se dicta por teléfono,
                  y ahí importa distinguir un cero de una o. */}
              <p className="mt-1 font-mono text-sm text-muted-foreground">{s.codigo}</p>

              <p className="mt-1 text-sm text-muted-foreground">
                {s.estado === 'pendiente'
                  ? vencida
                    ? 'Ya se venció. Renuévala si sigues necesitándolo.'
                    : `Se borra sola el ${new Date(s.expira_at).toLocaleDateString('es-CO')} si no responde.`
                  : s.estado === 'aceptada'
                    ? 'Ya no vence sola: acuerden los detalles por el chat.'
                    : 'Ya no aparece para nadie.'}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {s.proveedor_nombre && (
                  <BotonChat
                    origen={{ tipo: 'ficha', id: s.proveedor_id }}
                    etiqueta={`Escribir por AquíVe a ${s.proveedor_nombre}`}
                  />
                )}
                {s.estado === 'pendiente' && (
                  <>
                    <Button variant="outline" onClick={() => actuar(s.id, 'renovar')}>
                      Renovar 15 días
                    </Button>
                    <Button variant="ghost" onClick={() => actuar(s.id, 'cancelar')}>
                      Cancelar
                    </Button>
                  </>
                )}
                {s.estado === 'aceptada' && (
                  <Button variant="ghost" onClick={() => actuar(s.id, 'cancelar')}>
                    Cancelar
                  </Button>
                )}
                {s.proveedor_nombre && (
                  <Button
                    variant="link"
                    nativeButton={false}
                    render={<Link href={`/prestador/${s.proveedor_id}`} />}
                  >
                    Ver ficha
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
