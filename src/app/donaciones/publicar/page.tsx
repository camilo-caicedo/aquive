import { servidor } from '@/orpc/local'

import { FormularioDonacion } from './formulario-donacion'

export const metadata = { title: 'Publicar una donación' }

export default async function PublicarDonacionPage() {
  const [{ facetas }, acopios] = await Promise.all([
    // Los municipios que ya tienen gente, para no ofrecer los 1.100 del país.
    servidor.servicios.directorio({}),
    servidor.acopios.lista({}),
  ])

  return (
    <FormularioDonacion
      municipios={facetas.municipios}
      acopios={acopios.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        direccion: a.direccion,
      }))}
    />
  )
}
