import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { Bienvenida } from '@/components/bienvenida'
import { Directorio } from '@/components/directorio'

/**
 * La portada, y la decisión de qué es la portada.
 *
 * Tres casos, y ninguno es de conveniencia:
 *
 *   · Sin sesión, `/` a secas  → la BIENVENIDA. Decisión del responsable.
 *   · Con sesión               → el INICIO: los tres módulos y quién trabaja
 *                                ahora. Quien ya entró no necesita que le
 *                                expliquen qué es esto cada vez.
 *   · Con filtros en la URL    → el DIRECTORIO, con los filtros puestos.
 *
 * El tercero existe porque una URL con filtros viene de alguien que compartió
 * una búsqueda por WhatsApp —«mira, modistas en la comuna 3»—, y enseñarle una
 * bienvenida a quien abre ese enlace tira a la basura lo que lo hacía útil.
 *
 * Se RENDERIZA aquí en vez de redirigir a `/directorio`, y a propósito: un
 * `redirect()` desde un Server Component sale como 200 con la orden dentro,
 * así que quien no ejecuta JavaScript —un rastreador, un previsualizador de
 * enlaces de WhatsApp— recibe una página vacía en vez del listado. Lo que sí
 * hace falta es que ese listado tenga UNA dirección para el buscador, y de eso
 * se encarga el `canonical` de abajo: dos URL con el mismo contenido se
 * reparten el posicionamiento.
 *
 * ⚠ La decisión vive AQUÍ y no en `src/proxy.ts`. El proxy corre también sobre
 * `/api/*` y su único trabajo es refrescar el token de Supabase; meterle
 * enrutado de producto lo convierte en un sitio donde nadie va a buscarlo.
 *
 * ⚠ Y la bienvenida lleva el nombre y la frase de descripción palabra por
 * palabra, porque un rastreador nunca trae sesión: para Google, `/` ES la
 * bienvenida. La verificación de marca ya se cayó dos veces por menos.
 */
/**
 * El listado filtrado tiene su dirección propia. Si esta URL trae filtros, le
 * dice al buscador que la buena es aquella.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}): Promise<Metadata> {
  const params = await searchParams
  const puestos = Object.entries(params).filter(([, v]) => Boolean(v)) as [
    string,
    string,
  ][]
  if (puestos.length === 0) return {}
  return {
    alternates: {
      canonical: `/directorio?${new URLSearchParams(puestos).toString()}`,
    },
  }
}

export default async function PortadaPage({
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

  // Los filtros ganan sobre todo lo demás, con sesión o sin ella: ese
  // enlace lo compartió alguien con una búsqueda hecha, y devolverle una
  // presentación tira a la basura lo que lo hacía útil.
  if (hayFiltros) return <Directorio searchParams={searchParams} />

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // La bienvenida para todo el mundo (ADR 0010). La sesión ya no decide QUÉ
  // pantalla se sirve, solo cómo se ve: con ella la bienvenida conserva el
  // encabezado y la barra, y deja de ofrecer entrar. El inicio de siempre
  // vive en /inicio, que es a donde lleva la barra.
  return <Bienvenida conSesion={!!user} />
}
