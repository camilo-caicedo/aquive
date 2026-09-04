'use client'

import { useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

import { rpc } from '@/orpc/cliente'
import { calcularDimensionesDestino } from './subir-imagen-dimensiones'

// = `LADO_MAXIMO` de `src/server/imagenes/recorrido.ts`. El servidor va a
// redimensionar a esto de todas formas, así que subir más grande solo gasta
// datos y memoria del teléfono de quien sube.
const LADO_MAXIMO = 1600

// = `quality: 82` del `.webp()` de sharp en `recorrido.ts`. Comprimir aquí a
// otra calidad no ahorraría nada: el servidor recomprime a la suya de todos
// modos, así que las dos constantes tienen que leerse juntas.
const CALIDAD_WEBP = 0.82

// = `TOPE_BYTES` de `src/server/imagenes/almacen.ts`. Repetido aquí para
// avisar ANTES del viaje de ida y vuelta que el servidor iba a rechazar de
// todas formas.
const TOPE_BYTES = 2 * 1024 * 1024

/**
 * Comprimir en el navegador antes de subir: menos memoria en el pico de la
 * subida (el `File` crudo de una foto de teléfono son 4-8 MB) y menos datos
 * gastados. Es una optimización, no una garantía: si algo falla —formato que
 * el navegador no decodifica, canvas contaminado— se sube el archivo
 * original y el servidor hace su trabajo igual.
 */
async function comprimir(archivo: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(archivo)
    try {
      const { ancho, alto } = calcularDimensionesDestino(bitmap.width, bitmap.height, LADO_MAXIMO)

      let blob: Blob | null
      if (typeof OffscreenCanvas !== 'undefined') {
        const lienzo = new OffscreenCanvas(ancho, alto)
        const ctx = lienzo.getContext('2d')
        if (!ctx) return archivo
        ctx.drawImage(bitmap, 0, 0, ancho, alto)
        blob = await lienzo.convertToBlob({ type: 'image/webp', quality: CALIDAD_WEBP })
      } else {
        const lienzo = document.createElement('canvas')
        lienzo.width = ancho
        lienzo.height = alto
        const ctx = lienzo.getContext('2d')
        if (!ctx) return archivo
        ctx.drawImage(bitmap, 0, 0, ancho, alto)
        blob = await new Promise<Blob | null>((resolve) =>
          lienzo.toBlob(resolve, 'image/webp', CALIDAD_WEBP),
        )
      }

      if (!blob) return archivo
      return new File([blob], archivo.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' })
    } finally {
      // Libera el pico de memoria del bitmap decodificado apenas se puede:
      // si se queda vivo hasta que el `File` comprimido salga del scope, el
      // pico sigue ahí y la compresión no arregló nada.
      bitmap.close()
    }
  } catch {
    return archivo
  }
}

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
  onEstadoSubida,
}: {
  objetoTipo: 'muro' | 'producto' | 'proveedor'
  onSubida: (imagenId: string | null) => void
  /** Para que el formulario que la contiene apague su botón de publicar
   *  mientras la foto está en vuelo. Opcional: nada obliga a los tres
   *  formularios que usan este componente a escucharlo. */
  onEstadoSubida?: (subiendo: boolean) => void
}) {
  const [estado, setEstado] = useState<'vacio' | 'subiendo' | 'lista'>('vacio')
  const [error, setError] = useState<string | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)

  async function elegir(archivoOriginal: File) {
    setError(null)
    setEstado('subiendo')
    onEstadoSubida?.(true)
    try {
      const archivo = await comprimir(archivoOriginal)

      // Rechazar ANTES del viaje: quien pidió con datos móviles no debería
      // esperar la ida y vuelta completa para enterarse de que la foto no
      // cabía.
      if (archivo.size > TOPE_BYTES) {
        setError('Esta foto pesa demasiado incluso comprimida. Prueba con otra.')
        setEstado('vacio')
        onSubida(null)
        return
      }

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
    } finally {
      onEstadoSubida?.(false)
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
