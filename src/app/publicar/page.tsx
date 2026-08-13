import { createClient } from '@/lib/supabase/server'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormularioPublicar } from './formulario-publicar'

export default async function PublicarPage() {
  const supabase = await createClient()

  const [{ data: municipios }, { data: items }] = await Promise.all([
    supabase.from('municipios').select('*').eq('afectado', true).order('nombre'),
    supabase.from('catalogo_items').select('*').eq('activo', true).order('orden'),
  ])

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-bold">Publicar solicitud</h1>
      <Alert variant="warning" className="mt-2">
        <AlertDescription className="text-amber-900">
          Por tu seguridad, no escribas tu nombre, teléfono, dirección exacta
          ni datos de tus hijos. Solo pedimos el barrio y qué necesitas.
        </AlertDescription>
      </Alert>
      <FormularioPublicar municipios={municipios ?? []} items={items ?? []} turnstileSiteKey={siteKey} />
    </main>
  )
}
