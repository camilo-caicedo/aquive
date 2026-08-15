import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

/**
 * Cuántos municipios pinta un combobox a la vez.
 *
 * No es una preferencia de diseño: sin tope, abrir el selector monta los
 * 1.122 de golpe —4.500 nodos y unos 700 KB de HTML dentro de un popup—, y
 * en iPhone eso agota la memoria de la pestaña, que se recarga sola. Pasa
 * igual en Safari y en Chrome porque en iOS los dos son WebKit. El filtro
 * sigue recorriendo la lista completa: esto recorta lo que se pinta, no
 * dónde se busca.
 */
export const LIMITE_MUNICIPIOS = 50

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
