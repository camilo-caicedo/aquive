import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import { COLUMNAS_ITEM_PUBLICO } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
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

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-heading text-3xl">Publicar solicitud</h1>
      <Alert variant="warning" className="mt-2">
        <AlertDescription>
          Por tu seguridad, no escribas tu nombre, teléfono, dirección exacta
          ni datos de tus hijos. Solo pedimos el barrio y qué necesitas.
        </AlertDescription>
      </Alert>
      <FormularioPublicar municipios={municipios ?? []} items={items ?? []} turnstileSiteKey={siteKey} />
    </main>
  )
}
