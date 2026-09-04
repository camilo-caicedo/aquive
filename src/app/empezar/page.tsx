import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import { servidor } from '@/orpc/local'
import { FormularioEmpezar } from './formulario-empezar'

export const metadata = { title: 'Tu cuenta' }

/**
 * Abrir la cuenta. Dos campos (ADR 0015).
 *
 * Sustituye al asistente de tres pasos de `/registro`, cuyo primer paso era
 * «¿Qué vas a ofrecer?» con dos casillas y ninguna salida. Quien entraba a
 * buscar una modista tenía que declararse proveedor de algo, publicar su
 * teléfono y firmar una autorización de publicación para poder seguir.
 *
 * Aquí no se pide teléfono ni se firma nada: una cuenta recién abierta no
 * publica nada, y sin publicación no hay finalidad que autorizar (Ley 1581,
 * art. 9). La autorización aparece donde aparece la publicación — al armar el
 * carné, al declarar una matrícula, al publicar en el muro.
 *
 * ⚠ Y NO monta `VueltaAlDestino`. Lo explica `formulario-empezar.tsx`: en
 * `/registro` estaba montado en esta misma rama y saltaba al destino guardado
 * ANTES de que existiera la fila de `perfiles`, con lo que el recorrido
 * «Ofrezco mi trabajo → Google → carné» moría en una violación de llave
 * foránea. Aquí el destino se recoge después de guardar.
 */
export default async function EmpezarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Sin sesión no hay cuenta que abrir. Esto sí rebota, y no es el caso de
  // `/perfil`: allí hay algo que enseñar y aquí no hay nada.
  if (!user) redirect('/login')

  // Con cuenta abierta esta pantalla no tiene trabajo. Se llega aquí por el
  // callback, y el callback ya lo comprueba; esto es por si alguien guardó la
  // dirección.
  const cuenta = await servidor.cuentas.mia()
  if (cuenta) redirect('/inicio')

  const municipios = await listarMunicipios(supabase)

  return <FormularioEmpezar municipios={municipios} />
}
