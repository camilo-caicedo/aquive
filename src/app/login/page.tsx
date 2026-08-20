import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MarcoFlujo } from '@/components/marco-flujo'
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
    <MarcoFlujo
      titulo="Entrar para ofrecer ayuda"
      volver="/"
      accion={
        <>
          {/* Pegado al botón y no arriba (regla 5): lo que hay que saber
              antes de entregarle la cuenta de Google a un sitio se lee en
              el momento de entregarla, no tres párrafos antes. */}
          <Alert variant="warning" className="mb-3">
            <AlertDescription>
              No guardamos tu correo. De tu cuenta de Google solo conservamos un
              identificador interno.
            </AlertDescription>
          </Alert>
          <BotonGoogle />
        </>
      }
    >
      <p className="text-base text-muted-foreground">
        Solo necesitan cuenta quienes ofrecen insumos o servicios. Si necesitas
        ayuda, publica tu solicitud sin cuenta y sin dar tus datos.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            No se pudo iniciar sesión. Intenta de nuevo.
          </AlertDescription>
        </Alert>
      )}

      <p className="mt-6 text-base">
        <a href="/publicar" className="underline">
          Necesito ayuda, quiero publicar una solicitud
        </a>
      </p>
    </MarcoFlujo>
  )
}
