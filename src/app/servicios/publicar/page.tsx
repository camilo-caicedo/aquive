import { notFound } from 'next/navigation'
import { z } from 'zod'
import { servidor } from '@/orpc/local'
import { FormularioPublicarServicio } from './formulario-publicar-servicio'

export const metadata = { title: 'Pedir servicio' }

/**
 * Pedir un servicio, a un prestador concreto (ADR 0015).
 *
 * ⚠ Ya no es un flujo abierto: nace desde el botón «Pedir este servicio»
 * de una ficha, que trae `?proveedor=<id>` en la URL. Sin ese parámetro —o
 * con uno que no es un id, o de una ficha que ya no existe— no hay a quién
 * dirigir la orden, y eso es un 404 y no una pantalla a medias.
 *
 * ⚠ Consecuencia que el ADR no previó: el formulario ya no ofrece el
 * catálogo entero (81 oficios en doce categorías) — eso sería el tablero
 * abierto que el ADR 0014 acaba de retirar, solo que con un paso extra.
 * Solo se ofrece `ficha.oficios`, que ya viene filtrado por lo que ese
 * prestador de verdad declaró. Una ficha sin ningún oficio publicado no
 * tiene qué pedir.
 */
export default async function PublicarServicioPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedor?: string }>
}) {
  const { proveedor } = await searchParams
  const idValido = z.uuid().safeParse(proveedor)
  if (!idValido.success) notFound()

  const ficha = await servidor.servicios.ficha({ id: idValido.data })
  if (!ficha || ficha.oficios.length === 0) notFound()

  return (
    <FormularioPublicarServicio
      proveedorId={idValido.data}
      proveedorNombre={ficha.nombre_visible}
      oficios={ficha.oficios}
    />
  )
}
