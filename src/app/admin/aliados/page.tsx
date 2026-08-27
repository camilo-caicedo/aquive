import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { createClient } from '@/lib/supabase/server'
import { origenDelSitio } from '@/lib/origen'
import { listarMunicipios } from '@/lib/municipios'
import type { OrganizacionAdmin } from '@/lib/types'
import { PanelOrganizaciones } from '../panel-organizaciones'

export const metadata = { title: 'Aliados' }

/**
 * Las organizaciones aliadas y los hilos que se quedaron sin ninguna.
 *
 * Sin las dos sub-pestañas que había propuesto: eran un tercer nivel de
 * pestañas dentro de una pestaña, para una herramienta de una sola
 * persona. Lo urgente va arriba y lo demás debajo, en la misma pantalla.
 */
export default async function AliadosPage() {
  const supabase = await createClient()

  const [{ data: organizacionesData }, municipios, origen] = await Promise.all([
    // Por RPC y no por `select`: la tabla está revocada entera, y así
    // `creada_por` —el uuid de una persona real— no sale al navegador.
    supabase.rpc('organizaciones_admin'),
    listarMunicipios(supabase),
    origenDelSitio(),
  ])

  const organizaciones = (organizacionesData as unknown as OrganizacionAdmin[]) ?? []

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Aliados" volver="/admin" />

      <section className="mt-6">
        <h2 className="font-heading text-2xl">Organizaciones</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Una organización aliada coordina entregas dentro de AquíVe. No hay
          cola de verificación porque la verificación ocurre afuera, y eres tú.
        </p>
        <PanelOrganizaciones
          organizaciones={organizaciones}
          municipios={municipios}
          origen={origen}
        />
      </section>

    </main>
  )
}
