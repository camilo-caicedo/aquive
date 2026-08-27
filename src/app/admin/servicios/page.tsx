import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { createClient } from '@/lib/supabase/server'
import type { ZonaPropuesta } from '@/components/panel-zonas'
import {
  PanelServicios,
  type ColaServicios,
  type PanelServiciosDatos,
} from '../panel-servicios'

export const metadata = { title: 'Servicios' }

export default async function ServiciosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ cola?: string }>
}) {
  const { cola: crudo } = await searchParams
  const cola: ColaServicios =
    crudo === 'resenas' ||
    crudo === 'zonas' ||
    crudo === 'suspendidas' ||
    crudo === 'solicitudes'
      ? crudo
      : 'telefonos'

  const supabase = await createClient()
  const [{ data: serviciosData }, { data: zonasData }] = await Promise.all([
    supabase.rpc('panel_admin_servicios'),
    // Solo cuando se está mirando esa cola: las zonas propuestas son la
    // única de las cuatro que necesita su propia consulta.
    cola === 'zonas' ? supabase.rpc('zonas_propuestas') : Promise.resolve({ data: null }),
  ])

  const datos = serviciosData as unknown as PanelServiciosDatos | null
  const zonas = (zonasData as unknown as ZonaPropuesta[] | null) ?? []

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Servicios" volver="/admin" />
      {datos && <PanelServicios datos={datos} zonas={zonas} cola={cola} />}
    </main>
  )
}
