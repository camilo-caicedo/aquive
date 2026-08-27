'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { rpc } from '@/orpc/cliente'
import { NOMBRE_CATEGORIA_MURO, type MiPublicacionMuro } from '@/contrato/comunidad'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useHidratado } from '@/components/hidratado'

/**
 * Las publicaciones propias, con su estado y su salida.
 *
 * Borrar borra de verdad, con su foto (regla de producto 3). Por eso pide
 * confirmación en dos toques y no en un `confirm()` del navegador: el
 * diálogo del sistema no se puede leer con el resto de la pantalla delante,
 * y aquí lo que hay que leer es qué se va.
 */
export function ListaMisPublicaciones({
  publicaciones,
}: {
  publicaciones: MiPublicacionMuro[]
}) {
  const router = useRouter()
  const [borrando, setBorrando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Las fechas solo después de hidratar: el servidor va en UTC y el teléfono
  // en la hora de aquí (ADR 0005).
  const hidratado = useHidratado()

  async function borrar(id: string) {
    setOcupado(true)
    setError(null)
    try {
      await rpc.comunidad.borrarPublicacion({ id })
      setBorrando(null)
      router.refresh()
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo borrar. Inténtalo otra vez.')
    } finally {
      setOcupado(false)
    }
  }

  if (publicaciones.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
        Todavía no has publicado nada en el muro.
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

      <ul className="mt-6 space-y-3">
        {publicaciones.map((p) => {
          const vencida = p.expira_at ? new Date(p.expira_at) < new Date() : false
          return (
            <li key={p.id} className="shadow-canto rounded-2xl bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                {/* La cara va como palabra, no como color: es el dato que
                    cambia qué se publicó de esta persona. */}
                <span className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
                  {p.cara === 'ofrece' ? 'Ofrezco' : 'Necesito'} ·{' '}
                  {NOMBRE_CATEGORIA_MURO[p.categoria as keyof typeof NOMBRE_CATEGORIA_MURO] ??
                    p.categoria}
                </span>
                {vencida && (
                  <span className="bg-secondary text-secondary-foreground inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-sm font-medium">
                    Vencida
                  </span>
                )}
              </div>

              <div className="mt-2 flex gap-3">
                {p.imagen && (
                  <Image
                    src={p.imagen}
                    alt=""
                    width={64}
                    height={64}
                    className="size-16 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-lg leading-tight">{p.titulo}</h2>
                  {p.detalle && (
                    <p className="mt-0.5 line-clamp-2 text-base text-muted-foreground">
                      {p.detalle}
                    </p>
                  )}
                  <p className="mt-0.5 text-base text-muted-foreground">
                    {[p.zona_nombre, p.municipio_nombre].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>

              {/* El motivo del rechazo llega a quien la subió. Regla de
                  producto 8, paso 5: «Rechazada, se borra y quien la subió
                  recibe el motivo». */}
              {p.estado_imagen === 'rechazada' && (
                <p className="bg-accent text-accent-foreground mt-3 rounded-xl p-3 text-base">
                  Tu foto no se publicó: {p.motivo_imagen ?? 'no cumple las normas.'}
                </p>
              )}
              {p.estado_imagen === 'en_cola' && (
                <p className="mt-3 text-base text-muted-foreground">
                  Tu foto está en revisión. No se ve hasta que alguien la mire.
                </p>
              )}

              <p className="mt-2 text-sm text-muted-foreground">
                {hidratado
                  ? p.expira_at
                    ? vencida
                      ? 'Ya no aparece para nadie.'
                      : `Se borra sola el ${new Date(p.expira_at).toLocaleDateString('es-CO')}.`
                    : 'No caduca: se queda hasta que la borres.'
                  : ' '}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {borrando === p.id ? (
                  <>
                    <Button
                      variant="destructive"
                      disabled={ocupado}
                      onClick={() => borrar(p.id)}
                    >
                      Sí, borrarla
                    </Button>
                    <Button variant="ghost" onClick={() => setBorrando(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/muro?cara=${p.cara}`} />}
                    >
                      Ver en el muro
                    </Button>
                    <Button variant="ghost" onClick={() => setBorrando(p.id)}>
                      Borrar
                    </Button>
                  </>
                )}
              </div>
              {borrando === p.id && (
                <p className="mt-2 text-base text-muted-foreground">
                  Se borra de verdad, con su foto. No se puede deshacer.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
