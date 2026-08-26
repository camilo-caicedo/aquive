import { Directorio } from '@/components/directorio'

export const metadata = { title: 'Mapa' }

/**
 * La puerta vieja del mapa.
 *
 * El mapa dejó de ser una pantalla aparte: es el directorio con
 * `?vista=mapa`, porque lista y mapa son dos maneras de leer el mismo
 * resultado con los mismos filtros. Esta ruta se queda porque está en
 * enlaces compartidos.
 *
 * ⚠ Renderiza, no redirige. Un redirect en `next.config` con query en el
 * destino se come la que traía el enlace, y ahí se perdería justo lo que
 * hacía útil un «modistas en la comuna 3» pegado en WhatsApp.
 */
export default async function MapaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  return <Directorio searchParams={Promise.resolve({ ...params, vista: 'mapa' })} />
}
