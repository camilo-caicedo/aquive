import Link from 'next/link'
import { redirect } from 'next/navigation'
import { HandHeart, Briefcase } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { MarcoFlujo } from '@/components/marco-flujo'
import { BotonGoogle } from './boton-google'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; volver?: string }>
}) {
  const { error, volver } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/registro')

  return (
    <MarcoFlujo titulo="Entrar para ofrecer ayuda" volver="/">
      <p className="text-base text-muted-foreground">
        Solo necesitan cuenta quienes ofrecen insumos o servicios.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            No se pudo iniciar sesión. Intenta de nuevo.
          </AlertDescription>
        </Alert>
      )}

      {/* El aviso va en la tarjeta del botón, que es donde se decide, y no
          como un bloque suelto arriba (regla 5). */}
      <div className="mt-6 rounded-2xl bg-card p-4 shadow-sm">
        <Alert variant="warning">
          <AlertDescription>
            No guardamos tu correo. De tu cuenta de Google solo conservamos un
            identificador interno.
          </AlertDescription>
        </Alert>

        <div className="mt-3">
          <BotonGoogle destino={volver} />
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Al continuar aceptas los{' '}
          <Link href="/terminos" className="underline">
            términos de uso
          </Link>{' '}
          y el{' '}
          <Link href="/privacidad" className="underline">
            aviso de privacidad
          </Link>
          . Todavía no se publica nada: el perfil lo escribes tú en el
          siguiente paso.
        </p>
      </div>

      {/* Una salida de verdad, con su título y su botón. Antes era un enlace
          subrayado al final de la pantalla, debajo de todo lo que no le
          hacía falta leer a quien viene a pedir. */}
      <div className="mt-6 rounded-2xl bg-secondary p-4">
        <h2 className="font-heading text-2xl">¿Vienes a pedir ayuda?</h2>
        <p className="mt-1 text-base text-secondary-foreground">
          No necesitas cuenta. Publica tu solicitud sin dar tu nombre, tu
          teléfono ni tu dirección: solo el barrio y qué necesitas.
        </p>
        <Button
          variant="outline"
          className="mt-3 w-full"
          nativeButton={false}
          render={<Link href="/publicar" />}
        >
          <HandHeart className="size-5" aria-hidden="true" />
          Publicar una solicitud
        </Button>
      </div>

      {/* La tercera puerta. Se mencionaba solo dentro de
          /servicios/soy-proveedor, así que quien no tiene cuenta de Google
          —que es buena parte del rebusque, y a quien el módulo quiere
          incluir— llegaba aquí y se quedaba sin camino. */}
      <div className="mt-3 rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="font-heading text-2xl">¿Vives de un oficio y no tienes cuenta de Google?</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Una organización aliada puede registrarte y darte un enlace propio
          con el que manejas tu ficha: verla, corregirla y borrarla sin
          pedirle permiso a nadie.
        </p>
        <Button
          variant="outline"
          className="mt-3 w-full"
          nativeButton={false}
          render={<Link href="/servicios" />}
        >
          <Briefcase className="size-5" aria-hidden="true" />
          Ver el directorio de servicios
        </Button>
      </div>
    </MarcoFlujo>
  )
}
