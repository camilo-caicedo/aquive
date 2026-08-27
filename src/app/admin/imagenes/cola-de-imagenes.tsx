'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, X } from 'lucide-react'

import { rpc } from '@/orpc/cliente'

/** De dónde salió la imagen. Una ficha también puede llevar foto desde
 *  la migración v6-b7, y ahí el criterio de rechazo pesa más: es la cara
 *  de una persona. */
const DE_DONDE: Record<'muro' | 'producto' | 'proveedor', string> = {
  muro: 'Muro',
  producto: 'Producto',
  proveedor: 'Foto de ficha',
}

type EnCola = {
  id: string
  objeto_tipo: 'muro' | 'producto' | 'proveedor'
  objeto_id: string | null
  url: string
  ancho: number | null
  alto: number | null
  subida_at: string
}

const MOTIVOS = [
  'Aparece un menor de edad',
  'Documento o placa visible',
  'Datos de contacto en la imagen',
  'Contenido sexual o violento',
  'Foto de otra persona sin su permiso',
  'Otro',
]

/**
 * Una imagen a la vez, no una rejilla.
 *
 * Una rejilla de veinte miniaturas invita a aprobar en lote mirando por
 * encima, y aquí lo que se mira es si hay un menor en la foto. De una en una
 * y grande, que es el tamaño al que se ve lo que hay que ver.
 */
export function ColaDeImagenes({ inicial }: { inicial: EnCola[] }) {
  const [cola, setCola] = useState(inicial)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rechazando, setRechazando] = useState(false)

  const actual = cola[0]

  async function decidir(aprobar: boolean, motivo?: string) {
    if (!actual || ocupado) return
    setOcupado(true)
    setError(null)
    try {
      await rpc.comunidad.moderarImagen({ imagen_id: actual.id, aprobar, motivo })
      setCola((c) => c.slice(1))
      setRechazando(false)
    } catch (e) {
      const razon =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(razon ?? 'No se pudo guardar la decisión.')
    } finally {
      setOcupado(false)
    }
  }

  if (!actual) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
        Listo. No queda nada por revisar.
      </p>
    )
  }

  return (
    <section className="mt-6">
      <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
        {DE_DONDE[actual.objeto_tipo]}
        {actual.objeto_id === null && ' · sin publicación todavía'}
      </p>

      <div className="shadow-canto mt-2 overflow-hidden rounded-2xl bg-card">
        <Image
          src={actual.url}
          alt="Imagen pendiente de revisión"
          width={actual.ancho ?? 1200}
          height={actual.alto ?? 800}
          className="max-h-[60vh] w-full bg-muted object-contain"
          unoptimized
        />
      </div>

      {error && (
        <p role="alert" className="bg-accent text-accent-foreground mt-3 rounded-xl px-4 py-3 text-base">
          {error}
        </p>
      )}

      {rechazando ? (
        <div className="mt-4">
          <p className="text-base font-medium">¿Por qué se rechaza?</p>
          <div className="mt-2 flex flex-col gap-2">
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={ocupado}
                onClick={() => decidir(false, m)}
                className="shadow-canto min-h-14 rounded-xl bg-card px-4 text-left text-base hover:bg-muted disabled:opacity-40"
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRechazando(false)}
            className="text-enlace mt-3 min-h-12 text-base underline underline-offset-4"
          >
            Volver
          </button>
        </div>
      ) : (
        <div className="mt-4 flex gap-3">
          {/* Rechazar a la izquierda y en papel; aprobar a la derecha y en
              lima. Publicar es la acción de esta pantalla, y rechazar borra
              el archivo — conviene que cueste el gesto deliberado. */}
          <button
            type="button"
            disabled={ocupado}
            onClick={() => setRechazando(true)}
            className="shadow-canto flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-card text-base font-semibold disabled:opacity-40"
          >
            <X className="size-5" aria-hidden="true" />
            Rechazar
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => decidir(true)}
            className="bg-primary text-primary-foreground shadow-boton active:shadow-boton-hundido flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full text-base font-semibold transition-all active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40"
          >
            <Check className="size-5" aria-hidden="true" />
            Publicar
          </button>
        </div>
      )}

      <p className="mt-3 text-sm text-muted-foreground">
        Rechazar borra el archivo del almacén, no solo lo esconde. Quedan{' '}
        {cola.length - 1} después de esta.
      </p>
    </section>
  )
}
