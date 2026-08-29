import 'server-only'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { servidor } from '@/orpc/local'
import { listarMunicipios } from '@/lib/municipios'
import type { Database, MiProveedor } from '@/lib/types'
import type { MiReferencia } from '@/components/campos-referencia'
import type { MisServicios } from '@/components/panel-servicios-proveedor'

type Oficio = Database['public']['Tables']['catalogo_oficios']['Row']
type Zona = Database['public']['Tables']['zonas']['Row']

/**
 * Lo que casi todas las pantallas de `/perfil` necesitan, en una llamada.
 *
 * Las nueve pantallas del menú miran la misma ficha desde ángulos
 * distintos, así que la carga vive en un sitio: si cada `page.tsx` armara
 * su propio `Promise.all`, en la tercera ya habría dos formas distintas de
 * pedir lo mismo y una de ellas se quedaría sin el filtro de `activo`.
 *
 * ⚠ Sin sesión rebota a `/login`. Vale para las subpantallas, NO para
 * `/perfil`, que tiene su propia cara para quien publicó sin cuenta —el
 * rol central del sitio— y por eso no usa esto.
 */
export async function cargarPerfil() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    { data: mio, error: errorFicha },
    { data: oficios },
    { data: zonas },
    municipios,
    { data: refs },
    { data: servicios },
    cuenta,
    oficiosPropuestos,
  ] = await Promise.all([
    supabase.rpc('mi_proveedor', {}),
    supabase.from('catalogo_oficios').select('*').eq('activo', true).order('orden'),
    // Todas las zonas de una vez y se filtran al elegir municipio. Hoy son
    // 37 filas —solo Cali—; si algún día se siembran varias ciudades, esto
    // pasa a una consulta por municipio.
    supabase.from('zonas').select('*').eq('activa', true).order('orden'),
    listarMunicipios(supabase),
    supabase.rpc('mis_referencias', {}),
    supabase.rpc('mis_servicios', {}),
    // Los datos de la CUENTA, que son otra cosa que los de la ficha: el
    // nombre y el municipio los tiene cualquiera desde que entra, y la ficha
    // solo quien armó el carné (ADR 0015). Va por el contrato y no por un
    // `supabase.from('perfiles')`, que es lo que hacían tres pantallas por su
    // cuenta y ninguna de las tres serviría desde Expo.
    servidor.cuentas.mia(),
    // Las subcategorías que escribió y todavía no existen (ADR 0013). No
    // están en `mi_proveedor` porque no son oficios todavía: no tienen id
    // de catálogo y no se publican.
    servidor.servicios.oficiosPropuestos(),
  ])

  // ⚠ Un error del RPC NO es «no tienes ficha». Antes esto era
  // `(mio as … ) ?? null` y el error se descartaba: quien sí tenía carné y
  // pillaba un fallo de red veía las seis subpantallas rebotarlo al alta,
  // como si su ficha no existiera. Lo dejó escrito
  // `v6-b4-vuelve-el-proveedor-del-llamante.sql`, y seguía sin manejarse.
  if (errorFicha) throw new Error(`No se pudo leer tu ficha: ${errorFicha.message}`)

  const proveedor = (mio as MiProveedor | null) ?? null

  return {
    supabase,
    user,
    proveedor,
    /** Nombre, municipios y contacto de la cuenta. Existe siempre. */
    cuenta,
    oficios: (oficios ?? []) as Oficio[],
    oficiosPropuestos,
    zonas: (zonas ?? []) as Zona[],
    municipios: municipios ?? [],
    referencias: (refs as unknown as MiReferencia[]) ?? [],
    servicios: (servicios as unknown as MisServicios | null) ?? {
      codigos: [],
      resenas: [],
    },
    /** Solo los oficios del catálogo que están en su ficha. */
    misOficios: ((oficios ?? []) as Oficio[]).filter((o) =>
      proveedor?.oficios.some((p) => p.oficio_id === o.id),
    ),
  }
}

/**
 * El promedio de las tres notas de una reseña, sobre 5.
 *
 * Cada criterio va de 1 a 3 —«Mal», «Bien», «Muy bien»— y la ficha pública
 * enseña una nota sobre 5, así que la conversión tiene que ser la misma en
 * los dos sitios o el número de `/perfil/resenas` no cuadra con el que ve
 * el cliente.
 */
export function promedioResenas(
  resenas: MisServicios['resenas'],
): { nota: number; cuantas: number } | null {
  const visibles = resenas.filter((r) => !r.oculta)
  if (visibles.length === 0) return null
  const suma = visibles.reduce(
    (t, r) => t + (r.cumplimiento + r.trato + r.puntualidad) / 3,
    0,
  )
  // De la escala 1–3 a la de 5, que es la que se lee en la ficha.
  const nota = ((suma / visibles.length - 1) / 2) * 4 + 1
  return { nota: Math.round(nota * 10) / 10, cuantas: visibles.length }
}

/** Los códigos que todavía sirven: ni usados ni vencidos. */
export function codigosSinUsar(codigos: MisServicios['codigos']) {
  const ahora = Date.now()
  return codigos.filter(
    (c) => !c.confirmado_at && new Date(c.expira_at).getTime() > ahora,
  )
}
