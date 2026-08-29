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
  // Solo para rebotar a `/login` sin sesión. La pantalla no necesita datos:
  // los municipios se pedían para el aviso de «alguien pidió algo», que se
  // fue con el módulo de insumos (ADR 0014).
  await cargarPerfil()

  return (
    <MarcoFlujo titulo="Avisos" volver="/perfil">
      <InterruptorAvisos />
    </MarcoFlujo>
  )
}
