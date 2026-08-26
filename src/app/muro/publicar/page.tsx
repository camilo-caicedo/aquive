import { servidor } from '@/orpc/local'

import { FormularioMuro } from './formulario-muro'
import type { Cara } from '@/contrato/comunidad'

export const metadata = { title: 'Publicar en el muro' }

export default async function PublicarEnMuroPage({
  searchParams,
}: {
  searchParams: Promise<{ cara?: string }>
}) {
  const params = await searchParams
  const cara: Cara = params.cara === 'necesita' ? 'necesita' : 'ofrece'

  // Los municipios que ya tienen gente, para no ofrecer los 1.100 del país.
  const { facetas } = await servidor.servicios.directorio({})

  return <FormularioMuro cara={cara} municipios={facetas.municipios} />
}
