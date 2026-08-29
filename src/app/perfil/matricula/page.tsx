import { servidor } from '@/orpc/local'
import { createClient } from '@/lib/supabase/server'
import { cargarPerfil } from '../cargar'
import { FormularioMatricula } from './formulario-matricula'

export const metadata = { title: 'Mi matrícula' }

/**
 * Declarar la matrícula profesional.
 *
 * Vivía dentro del asistente de `/registro`, mezclada con el alta de la
 * cuenta y con el inventario de insumos. Al retirarse ese módulo (ADR 0014)
 * esto se quedaba sin puerta, y con ella `/profesionales` se quedaba sin
 * altas nuevas.
 *
 * Es lo único que sube una cuenta de `vecino` a `servidor`, así que es lo
 * único —fuera del carné— que lleva casilla de autorización: a partir de
 * aquí `servidores_publicos` publica el nombre y el teléfono de esta persona.
 */
export default async function MatriculaPage() {
  const { cuenta } = await cargarPerfil()

  const supabase = await createClient()
  const [matricula, { data: servicios }] = await Promise.all([
    servidor.servicios.miMatricula(),
    supabase.from('catalogo_servicios').select('*').eq('activo', true).order('orden'),
  ])

  return (
    <FormularioMatricula
      matricula={matricula}
      servicios={servicios ?? []}
      contactoInicial={cuenta?.contacto_publico ?? ''}
      contactoTipoInicial={cuenta?.contacto_tipo ?? 'whatsapp'}
    />
  )
}
