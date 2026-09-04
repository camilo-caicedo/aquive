import { Inicio } from '@/components/inicio'

export const metadata = { title: 'Inicio' }

/**
 * El inicio con URL propia.
 *
 * `/` sirve la bienvenida a quien no tiene sesión, así que quien elige
 * «Necesito un servicio» necesita adónde ir sin crear una cuenta. Es la misma
 * pantalla que ve en `/` quien sí entró.
 */
export default async function InicioRuta({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string }>
}) {
  const { municipio } = await searchParams
  return <Inicio municipio={municipio} />
}
