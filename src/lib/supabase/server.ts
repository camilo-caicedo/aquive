import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types'

// Usar dentro de Server Components, Route Handlers y Server Actions.
// En un Server Component puro, cookies.set() falla silenciosamente (esperado):
// la sesión se refresca vía el proxy (proxy.ts), no aquí.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Llamado desde un Server Component: ignorar, el proxy (proxy.ts) refresca la sesión.
          }
        },
      },
    }
  )
}
