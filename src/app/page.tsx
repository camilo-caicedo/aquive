import { createClient } from '@/lib/supabase/server'
import { Bienvenida } from '@/components/bienvenida'
import { Directorio } from '@/components/directorio'

/**
 * La portada, y la decisión de qué es la portada.
 *
 * Decisión del responsable: **quien llega sin sesión ve la bienvenida**, no el
 * directorio. Pero hacerlo a secas rompería dos cosas, así que hay tres casos:
 *
 *   · Con sesión                    → el directorio. Ya eligió qué viene a hacer.
 *   · Sin sesión, `/` a secas       → la bienvenida (pantalla 01).
 *   · Sin sesión, `/?oficio=…`      → el directorio, con sus filtros puestos.
 *
 * El tercero no es una excepción de conveniencia. Una URL con filtros viene de
 * alguien que compartió una búsqueda por WhatsApp —«mira, modistas en la
 * comuna 3»— y enseñarle una bienvenida a quien abre ese enlace tira a la
 * basura justo lo que lo hacía útil. Los filtros viven en la URL precisamente
 * para eso.
 *
 * ⚠ La decisión vive AQUÍ y no en `src/proxy.ts`. El proxy corre también sobre
 * `/api/*` y su único trabajo es refrescar el token de Supabase; meterle
 * enrutado de producto lo convierte en un sitio donde nadie va a buscarlo
 * cuando esto no haga lo que se espera.
 *
 * ⚠ Y la bienvenida lleva el nombre y la frase de descripción palabra por
 * palabra, porque un rastreador nunca trae sesión: para Google, `/` ES la
 * bienvenida. La verificación de marca ya se cayó dos veces por menos.
 */
export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{
    oficio?: string
    grupo?: string
    municipio?: string
    zona?: string
    modalidad?: string
    modo?: string
  }>
}) {
  const params = await searchParams
  const hayFiltros = Object.values(params).some(Boolean)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !hayFiltros) return <Bienvenida />

  return <Directorio searchParams={searchParams} />
}
