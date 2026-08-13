import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

// Bypasa RLS. Solo para Route Handlers y Server Actions, nunca para código
// que corre en el navegador. Las RPC ya son security definer, así que esto
// es defensa adicional, no el único guardián.
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
