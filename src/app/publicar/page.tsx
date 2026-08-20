import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import { COLUMNAS_ITEM_PUBLICO } from '@/lib/types'
import { FormularioPublicar } from './formulario-publicar'

export default async function PublicarPage() {
  const supabase = await createClient()

  const [municipios, { data: items }] = await Promise.all([
    listarMunicipios(supabase),
    // Columnas explícitas y no `select('*')`: esta página es anónima y
    // `catalogo_items` tiene `creado_por`, el uuid de quien aprobó el ítem.
    supabase
      .from('catalogo_items')
      .select(COLUMNAS_ITEM_PUBLICO)
      .eq('activo', true)
      .order('orden'),
  ])

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

  // El marco lo monta el formulario: el título, el progreso y la barra de
  // acción dependen del paso, y el paso vive ahí dentro.
  return (
    <FormularioPublicar
      municipios={municipios ?? []}
      items={items ?? []}
      turnstileSiteKey={siteKey}
    />
  )
}
