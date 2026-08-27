'use client'

import { useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

import { rpc } from '@/orpc/cliente'

/**
 * Subir una imagen. Regla de producto 8.
 *
 * El archivo va DIRECTO al almacén con una URL firmada: no atraviesa ninguna
 * función del servidor. Desde un teléfono con señal mala, una subida que pasa
 * por nuestra función es un tiempo de espera agotado.
 *
 * Después se avisa al servidor para que la reencodifique y le quite el EXIF
 * —donde viven las coordenadas GPS de la foto— y la deje en la cola de
 * moderación. Lo que se dice en pantalla es lo que de verdad pasa: la imagen
 * no se ve hasta que alguien la mire.
 */
export function SubirImagen({
  objetoTipo,
  onSubida,
}: {
  objetoTipo: 'muro' | 'producto' | 'proveedor'
  onSubida: (imagenId: string | null) => void
}) {
  const [estado, setEstado] = useState<'vacio' | 'subiendo' | 'lista'>('vacio')
  const [error, setError] = useState<string | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)

  async function elegir(archivo: File) {
    setError(null)
    setEstado('subiendo')
    try {
      const { imagen_id, url } = await rpc.comunidad.firmarImagen({
        objeto_tipo: objetoTipo,
        tipo: archivo.type,
        bytes: archivo.size,
      })

      const subida = await fetch(url, { method: 'PUT', body: archivo })
      if (!subida.ok) throw new Error('La subida no llegó')

      await rpc.comunidad.procesarImagen({ imagen_id })

      // La previsualización es local, del archivo que la persona acaba de
      // elegir. La del servidor todavía no es pública —está en cola— y
      // pedirla daría un 404 que se lee como un fallo.
      setPrevia(URL.createObjectURL(archivo))
      setEstado('lista')
      onSubida(imagen_id)
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo subir la imagen. Inténtalo otra vez.')
      setEstado('vacio')
      onSubida(null)
    }
  }

  function quitar() {
    setPrevia(null)
    setEstado('vacio')
    setError(null)
    onSubida(null)
  }

  return (
    <div>
      {previa ? (
        <div className="relative">
          {/* ⚠ Era `h-48 object-cover`, que recortaba: de una foto vertical
              se veía una franja del centro, y quien la sube no podía
              comprobar qué estaba mandando. Con `object-contain` se ve
              entera sea cual sea su forma, `bg-muted` rellena lo que sobra
              a los lados con un token, y el tope de 70vh evita que una foto
              de teléfono empuje el botón de guardar fuera de la pantalla. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previa}
            alt="La imagen que elegiste"
            className="shadow-canto max-h-[70vh] w-full rounded-2xl bg-muted object-contain"
          />
          <button
            type="button"
            onClick={quitar}
            className="pulsable shadow-canto absolute top-2 right-2 flex size-12 items-center justify-center rounded-full bg-card"
            aria-label="Quitar la imagen"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label className="shadow-canto flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-card px-4 text-base">
          <ImagePlus className="size-5" aria-hidden="true" />
          {estado === 'subiendo' ? 'Subiendo…' : 'Agregar una foto (opcional)'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={estado === 'subiendo'}
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              if (archivo) void elegir(archivo)
            }}
          />
        </label>
      )}

      {error && (
        <p role="alert" className="bg-accent text-accent-foreground mt-2 rounded-xl px-4 py-3 text-base">
          {error}
        </p>
      )}

      <p className="mt-2 text-sm text-muted-foreground">
        Máximo 2 MB. Una persona la revisa antes de que se vea: si tiene datos
        de alguien, un documento o a un menor, no se publica.
      </p>
    </div>
  )
}
