import { servidor } from '@/orpc/local'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { ColaDeImagenes } from './cola-de-imagenes'

export const metadata = { title: 'Imágenes por revisar' }

/**
 * La cola de moderación de imágenes. Regla de producto 8.
 *
 * Ninguna imagen se publica sin que una persona la mire. Esto no es una
 * formalidad: un texto se filtra con expresiones regulares, una imagen no.
 *
 * El permiso se comprueba en el procedimiento, no aquí: esta pantalla sin
 * datos es una pantalla vacía, pero un endpoint sin comprobación es un
 * endpoint abierto.
 */
export default async function ImagenesPage() {
  const cola = await servidor.comunidad.colaDeImagenes()

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Imágenes" volver="/admin" />
      <p className="text-base text-muted-foreground">
        {cola.length === 0
          ? 'No hay imágenes esperando revisión.'
          : `${cola.length} ${cola.length === 1 ? 'imagen espera' : 'imágenes esperan'} revisión. La más vieja primero.`}
      </p>

      {/* Los criterios, arriba y a la vista. Quien modera veinte imágenes
          seguidas no se acuerda de una lista que está en otra pantalla. */}
      <div className="shadow-canto mt-4 rounded-2xl bg-card p-4">
        <h2 className="font-heading text-base">Se rechaza</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-muted-foreground">
          <li>
            <strong className="text-foreground">Menores identificables.</strong> No es
            discrecional: es el artículo 7 de la Ley 1581.
          </li>
          <li>Documentos de identidad, placas de vehículo.</li>
          <li>Teléfonos, correos o direcciones escritos dentro de la imagen.</li>
          <li>Contenido sexual o violento.</li>
          <li>Fotos de otra persona publicadas sin que ella lo sepa.</li>
        </ul>
      </div>

      {cola.length > 0 && <ColaDeImagenes inicial={cola} />}
    </main>
  )
}
