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
 * Cómo se escribe un municipio cuando hay que mostrarlo: «Santiago de Cali,
 * Valle del Cauca».
 *
 * El departamento no es adorno. Hay 66 nombres repetidos en el país:
 * Buenavista existe en Boyacá, Córdoba, Quindío y Sucre; La Unión, en
 * Antioquia, Nariño, Sucre y Valle del Cauca. Sin el departamento, «La
 * Unión» no dice a dónde hay que llevar nada.
 *
 * Para comparar y para filtrar se sigue usando `codigo_dane`: esto es
 * texto para leer, nunca una llave.
 */
export function nombreConDepartamento(m: MunicipioBasico) {
  return `${m.nombre}, ${m.departamento}`
}

/** Código DANE → nombre completo, para pintar listas de municipios. */
export function mapaDeNombres(municipios: MunicipioBasico[]) {
  return new Map(municipios.map((m) => [m.codigo_dane, nombreConDepartamento(m)]))
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
