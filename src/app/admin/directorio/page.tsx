import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import { COLUMNAS_ENTIDAD_ADMIN } from '@/lib/types'
import { PanelEntidades, type EntidadAdmin } from '../panel-entidades'

export const metadata = { title: 'Directorio' }

export default async function DirectorioPage() {
  const supabase = await createClient()

  const [{ data: entidadesData }, municipios] = await Promise.all([
    // Columnas explícitas: `select('*')` arrastraría `creada_por`, el uuid
    // de `auth.users` de quien dio de alta la entidad.
    supabase.from('entidades').select(COLUMNAS_ENTIDAD_ADMIN).order('orden').order('nombre'),
    listarMunicipios(supabase),
  ])

  const entidades: EntidadAdmin[] = entidadesData ?? []

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Directorio" volver="/admin">
        <p className="mt-1 text-base text-muted-foreground">
          Aparecer aquí no es una recomendación: solo dice que la organización
          existe.
        </p>
      </CabeceraPantalla>

      <PanelEntidades entidades={entidades} municipios={municipios} />
    </main>
  )
}
