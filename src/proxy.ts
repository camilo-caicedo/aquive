import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/types'
import {
  COOKIE_PASO,
  enMantenimiento,
  llaveEnLaUrl,
  respuestaMantenimiento,
  tienePaso,
} from '@/lib/mantenimiento'

// En Next 16 este archivo se llama `proxy.ts` (antes `middleware.ts`).
// Su única función es refrescar el token de Supabase: sin esto la sesión
// muere a la hora, porque un Server Component no puede escribir cookies.
//
// También cierra la aplicación durante una ventana de mantenimiento. Va
// aquí y no en un layout porque así ninguna ruta —ni las de `/api`— llega
// a ejecutarse: no se puede publicar contra un esquema a medio migrar.
//
// La redirección de aquive.vercel.app y www.aquive.co hacia aquive.co NO
// se hace aquí: está configurada en el propio Vercel, que responde el 308
// antes de ejecutar nada. Es más rápido, no gasta invocaciones y sigue
// funcionando aunque la aplicación falle.
export async function proxy(request: NextRequest) {
  if (enMantenimiento()) {
    // Canjear la llave por cookie y quitarla de la URL, en el mismo salto.
    if (llaveEnLaUrl(request)) {
      const limpia = request.nextUrl.clone()
      limpia.searchParams.delete('llave')
      const salto = NextResponse.redirect(limpia)
      salto.cookies.set(COOKIE_PASO, process.env.MANTENIMIENTO_LLAVE!, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8,
      })
      return salto
    }

    if (!tienePaso(request)) return respuestaMantenimiento(request)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  // Excluye estáticos: no tiene sentido refrescar la sesión al pedir un .css
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
