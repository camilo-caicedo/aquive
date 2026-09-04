import { redirect } from 'next/navigation'

/**
 * Puerta vieja.
 *
 * El muro se llamaba «/muro» cuando tenía dos caras —lo que sobra y lo que
 * falta—. El ADR 0016 quitó la cara de pedidos y con ella el nombre: lo que
 * queda son donaciones, y vive en /donaciones.
 *
 * Se queda redirigiendo con los filtros puestos: hay enlaces repartidos —el
 * pie de página, `/acopios`, quizás un mensaje ya enviado— y un 404 aquí
 * manda a pensar que la función desapareció.
 */
export default async function PuertaVieja({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sp = new URLSearchParams()
  for (const [clave, valor] of Object.entries(params)) {
    if (typeof valor === 'string') sp.set(clave, valor)
    else if (Array.isArray(valor)) for (const v of valor) sp.append(clave, v)
  }
  const qs = sp.toString()
  redirect(qs ? `/donaciones?${qs}` : '/donaciones')
}
