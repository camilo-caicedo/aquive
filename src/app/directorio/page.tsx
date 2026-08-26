import { Directorio } from '@/components/directorio'

export const metadata = { title: 'Directorio' }

/**
 * La URL canónica del directorio.
 *
 * Existe porque `/` pasó a ser la bienvenida para quien no tiene sesión, y un
 * buscador nunca la tiene: sin esta ruta, el directorio —que es el contenido
 * del sitio— no tendría ninguna dirección estable que indexar.
 *
 * También es a donde apunta la tarjeta «Necesito un servicio» de la
 * bienvenida, y el destino al que vuelve quien navega dentro del directorio.
 */
export default function DirectorioPage({
  searchParams,
}: {
  searchParams: Promise<{
    oficio?: string
    grupo?: string
    municipio?: string
    zona?: string
    modalidad?: string
    modo?: string
  }>
}) {
  return <Directorio searchParams={searchParams} />
}
