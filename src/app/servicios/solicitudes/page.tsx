import { redirect } from 'next/navigation'

/**
 * Puerta vieja.
 *
 * La demanda de servicios subió a /solicitudes cuando el directorio pasó a
 * ser la portada: dejó de ser una sección de /servicios para ser un destino
 * propio de la barra.
 *
 * Se queda redirigiendo con los filtros puestos: un enlace compartido en
 * un grupo de WhatsApp tiene que seguir sirviendo.
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
  redirect(qs ? `/solicitudes?${qs}` : '/solicitudes')
}
