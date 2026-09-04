import 'server-only'

import { createClient } from '@/lib/supabase/server'

// El contexto que viaja con cada llamada al contrato.
//
// Regla 1 de arquitectura del ADR 0001: quien lee cookies es el BORDE, y pasa
// el valor hacia adentro. La capa de dominio recibe un `usuarioId` que es un
// texto o null, y no sabe —ni tiene que saber— si vino de una cookie, de una
// cabecera `Authorization` o de una prueba.
//
// Ese aislamiento es lo que hace que el paso 6 del ADR 0001 —cambiar Supabase
// Auth por better-auth— sea reescribir ESTE archivo y nada más. Y es lo que
// permitirá que la aplicación de Expo mande un Bearer en vez de una cookie
// sin que el dominio se entere.

export type Contexto = {
  /** El identificador opaco de quien está en sesión, o null si no la hay. */
  usuarioId: string | null
}

export async function contextoDeLaPeticion(): Promise<Contexto> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return { usuarioId: data.user?.id ?? null }
  } catch {
    // Sin sesión no es un error: la mayor parte del directorio se lee sin
    // cuenta, y una portada que reventara porque no hay cookie sería peor
    // que una portada sin la cinta de «tu ficha».
    return { usuarioId: null }
  }
}
