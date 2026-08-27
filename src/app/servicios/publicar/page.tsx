import { createClient } from '@/lib/supabase/server'
import { servidor } from '@/orpc/local'
import { listarMunicipios } from '@/lib/municipios'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormularioPublicarServicio } from './formulario-publicar-servicio'

export const metadata = { title: 'Necesito un servicio' }

export default async function PublicarServicioPage() {
  const supabase = await createClient()

  // ⚠ El catálogo vuelve a esta pantalla con el ADR 0013. El ADR 0011 lo
  // había sacado por largo —cuarenta y tantas píldoras juntas— y lo que
  // faltaba no era quitarlo: era enseñar solo las de la categoría elegida,
  // con la salida escrita siempre delante.
  //
  // Son 81 filas de cuatro campos, unos 6 KB. Van enteras al cliente para
  // que cambiar de categoría no sea otra ida y vuelta al servidor.
  const [municipios, { data: zonas }, subcategorias] = await Promise.all([
    listarMunicipios(supabase),
    supabase.from('zonas').select('*').eq('activa', true).order('orden'),
    servidor.servicios.subcategorias(),
  ])

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-heading text-3xl">Necesito un servicio</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Publica qué te hace falta y quien pueda hacerlo te responde con su
        teléfono. Tú decides a quién escribirle.
      </p>
      <Alert variant="warning" className="mt-3">
        <AlertDescription>
          No escribas tu nombre, tu teléfono ni tu dirección exacta. No los
          pedimos y no los guardamos: quien te responda te va a dejar el suyo,
          y tú eliges.
        </AlertDescription>
      </Alert>

      <FormularioPublicarServicio
        municipios={municipios ?? []}
        zonas={zonas ?? []}
        subcategorias={subcategorias}
        turnstileSiteKey={siteKey}
      />
    </main>
  )
}
