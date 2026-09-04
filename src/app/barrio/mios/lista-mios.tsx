'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'

import { rpc } from '@/orpc/cliente'
import { precioDeProducto } from '@/lib/servicios'
import { Button } from '@/components/ui/button'
import type { MiProducto } from '@/contrato/comunidad'

/**
 * Mis productos, con sus tres acciones.
 *
 * «Hoy no hay», «corregir» y «borrar» son cosas distintas y por eso son tres
 * botones:
 * los tamales del domingo se apagan el lunes y vuelven el sábado, y
 * obligar a escribirlos otra vez cada semana es lo que hace que la lista se
 * llene de cosas que ya no están.
 *
 * Borrar borra de verdad, con su foto (regla de producto 3). Por eso pide
 * confirmación en el sitio y no en un diálogo del navegador: un `confirm()`
 * bloquea la página entera y en un teléfono sale como un aviso del sistema
 * que nadie lee.
 */
export function ListaMios({ productos }: { productos: MiProducto[] }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function conError(accion: () => Promise<unknown>) {
    setError(null)
    accion()
      .then(() => iniciar(() => router.refresh()))
      .catch((e) => {
        const motivo =
          e && typeof e === 'object' && 'data' in e
            ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
            : null
        setError(motivo ?? 'No se pudo. Inténtalo otra vez.')
      })
  }

  if (productos.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
        Todavía no has puesto nada a la venta.
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
        {productos.map((p) => (
          <li key={p.id} className="shadow-canto rounded-2xl bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-heading text-lg leading-tight">{p.nombre}</h2>
              {/* El estado no depende solo del color: lleva su palabra. */}
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${
                  p.disponible
                    ? 'bg-ok-suave text-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {p.disponible ? 'A la venta' : 'Hoy no hay'}
              </span>
            </div>

            <p className="mt-1 text-base font-semibold">
              {precioDeProducto(p.modo, p.precio_desde, p.unidad)}
            </p>
            {p.detalle && (
              <p className="mt-1 text-base text-muted-foreground">{p.detalle}</p>
            )}

            {confirmando === p.id ? (
              <div className="bg-accent text-accent-foreground mt-3 rounded-2xl p-3">
                <p className="text-base">
                  Se borra de verdad, con su foto, y no se puede recuperar.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() =>
                      conError(() => rpc.comunidad.borrarProducto({ id: p.id }))
                    }
                  >
                    Sí, borrarlo
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmando(null)}>
                    Dejarlo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/barrio/mios/${p.id}`} />}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Corregir
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    conError(() =>
                      rpc.comunidad.disponibilidadProducto({
                        id: p.id,
                        disponible: !p.disponible,
                      }),
                    )
                  }
                >
                  {p.disponible ? 'Marcar «hoy no hay»' : 'Volver a ponerlo'}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmando(p.id)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Borrar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
