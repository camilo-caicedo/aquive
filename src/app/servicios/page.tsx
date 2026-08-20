import { redirect } from 'next/navigation'

/**
 * La puerta vieja del directorio.
 *
 * El directorio se mudó a la portada, pero /servicios lleva meses en
 * carteles de albergues, en enlaces de WhatsApp y en la memoria de quien
 * ya lo usaba. Un 404 ahí sería tirar todo eso a la basura, así que la
 * ruta se queda redirigiendo — con los filtros puestos, que es lo que
 * hace que un enlace compartido siga sirviendo.
 *
 * Las rutas de debajo —/servicios/[id], /servicios/publicar,
 * /servicios/solicitudes— no se tocan: siguen donde estaban.
 */
export default async function ServiciosPage({
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
  redirect(qs ? `/?${qs}` : '/')
}
