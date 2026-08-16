import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// ---------------------------------------------------------------------
// Único sitio auditado del proyecto donde se usa la llave de servicio.
//
// `createServiceClient()` bypasa RLS. Antes se importaba suelto desde media
// docena de rutas y libs; ahora entra por aquí para que toda consulta con
// rol de servicio sea grepeable en un solo directorio (`src/lib/backend/`)
// y cualquiera que quiera saber qué toca la llave mire un archivo, no siete.
//
// `import 'server-only'` corta de raíz que esto acabe en un bundle de
// cliente: si alguien lo importa desde un componente de navegador, revienta
// en build, no en producción. Las RPC ya son security definer, así que
// esto es defensa adicional, no el único guardián.
// ---------------------------------------------------------------------

export { createServiceClient }

/**
 * Nombre visible de un municipio a partir de su código DANE. `null` si no
 * existe. Lookup de solo lectura con rol de servicio: la tabla `municipios`
 * es pública en contenido pero se consulta aquí para no repartir el patrón
 * `.from('municipios')` por las rutas.
 */
export async function nombreMunicipio(codigo: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('municipios')
    .select('nombre')
    .eq('codigo_dane', codigo)
    .maybeSingle()
  return data?.nombre ?? null
}

/**
 * De un lote de hashes de token, cuáles siguen vivos en `solicitudes`.
 * Devuelve `null` si la consulta falla —ante la duda no se borra nada, que
 * perder un enlace guardado es irreversible— y la lista de hashes vigentes
 * si sale bien. Los tokens en claro nunca tocan el servidor: solo su hash.
 */
export async function solicitudesVigentesPorHash(
  hashes: string[],
): Promise<string[] | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('solicitudes')
    .select('token_hash')
    .in('token_hash', hashes)
  if (error) return null
  return (data ?? []).map((fila) => fila.token_hash)
}
