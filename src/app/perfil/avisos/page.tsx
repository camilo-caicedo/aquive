import { MarcoFlujo } from '@/components/marco-flujo'
import { cargarPerfil } from '../cargar'
import { InterruptorAvisos } from './interruptor'

export const metadata = { title: 'Avisos' }

/**
 * Pantalla 24 · Avisos.
 *
 * Flujo y no destino (regla 9): se entra a cambiar una cosa y se vuelve a
 * `/perfil`. Sin barra inferior, con la flecha arriba.
 */
export default async function AvisosPage() {
  const { supabase, user } = await cargarPerfil()

  // Los avisos de solicitudes son de TUS municipios, y esos viven en el
  // perfil del módulo de emergencia, no en la ficha de prestador.
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('municipios')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <MarcoFlujo titulo="Avisos" volver="/perfil">
      <InterruptorAvisos municipios={perfil?.municipios.length ?? 0} />
    </MarcoFlujo>
  )
}
