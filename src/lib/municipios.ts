import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

export interface MunicipioBasico {
  codigo_dane: string
  nombre: string
  departamento: string
}

/**
 * Trae los 1.122 municipios del país.
 *
 * Va por RPC y no por `.from('municipios')` porque PostgREST corta en
 * 1000 filas y Supabase impone ese tope del lado del servidor: ni `limit`
 * ni `Range` lo suben. Con una consulta normal desaparecían los 122 del
 * final del alfabeto —Yumbo, Zarzal, Zona Bananera— y quien vive ahí no
 * podía ni publicar una solicitud ni registrarse.
 *
 * La RPC devuelve un único jsonb: una fila, y una fila nunca se corta.
 */
export async function listarMunicipios(
  supabase: SupabaseClient<Database>
): Promise<MunicipioBasico[]> {
  const { data, error } = await supabase.rpc('listar_municipios')
  if (error || !data) return []
  return data as unknown as MunicipioBasico[]
}
