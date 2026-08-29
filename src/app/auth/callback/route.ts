import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Único punto donde entra la sesión de Google.
// Del objeto de sesión se usa EXCLUSIVAMENTE `user.id`. El correo que
// Google devuelve se ignora a propósito: no se lee, no se guarda, no se
// loggea (CLAUDE.md — autenticación).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=1`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=1`)
  }

  // Volver a /unirse es el único destino distinto que existe, y por eso el
  // permitido es una expresión exacta y no «cualquier ruta relativa»: con
  // lo segundo, `next=//evil.com` o `next=/\evil.com` se convierten en un
  // redirect abierto desde una URL que la gente ya considera de confianza.
  const siguiente = searchParams.get('next')
  if (siguiente && /^\/unirse\/[a-z0-9-]{3,40}$/.test(siguiente)) {
    return NextResponse.redirect(`${origin}${siguiente}`)
  }

  // El perfil no puede crearse aquí: el nombre visible y el municipio los
  // escribe la persona en /empezar. Aquí solo se decide a dónde va.
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle()

  return NextResponse.redirect(perfil ? `${origin}/` : `${origin}/empezar`)
}
