import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BotonGoogle } from './boton-google'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/registro')

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-heading text-3xl">Entrar para ofrecer ayuda</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Solo necesitan cuenta quienes ofrecen insumos o servicios. Si necesitas
        ayuda, publica tu solicitud sin cuenta y sin dar tus datos.
      </p>

      <Alert variant="warning" className="mt-4">
        <AlertDescription>
          No guardamos tu correo. De tu cuenta de Google solo conservamos un
          identificador interno.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            No se pudo iniciar sesión. Intenta de nuevo.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6">
        <BotonGoogle />
      </div>

      <p className="mt-6 text-base">
        <a href="/publicar" className="underline">
          Necesito ayuda, quiero publicar una solicitud
        </a>
      </p>
    </main>
  )
}
