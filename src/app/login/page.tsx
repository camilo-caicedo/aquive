import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Mail, Plus } from 'lucide-react'
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
    <MarcoFlujo titulo="Entrar" volver="/">
      <h2 className="font-heading text-3xl leading-tight">
        Entra para poder responder
      </h2>
      <p className="mt-2 text-base text-muted-foreground">
        La cuenta es para quien ofrece: sirve para que tu nombre y tu contacto
        sean tuyos, y para que solo tú puedas cambiarlos o borrarlos.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            No se pudo iniciar sesión. Intenta de nuevo.
          </AlertDescription>
        </Alert>
      )}

      {/* Lo del correo va DENTRO de la tarjeta del botón, que es donde se
          decide, y no como un bloque de aviso suelto arriba (regla 5). La
          tarjeta lleva borde terracota porque es la acción de la pantalla. */}
      <div className="mt-6 rounded-2xl border border-primary/40 bg-card p-4">
        <p className="flex items-start gap-2 text-base">
          <Mail className="size-5 shrink-0 translate-y-0.5 text-primary" aria-hidden="true" />
          <span>
            <strong className="font-semibold">No guardamos tu correo.</strong> De
            tu cuenta de Google conservamos un identificador interno y nada más.
            No lo leemos, no lo guardamos y no queda en ningún registro.
          </span>
        </p>

        <div className="mt-4">
          <BotonGoogle destino={volver} />
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Al continuar aceptas los{' '}
          <Link href="/terminos" className="underline">
            términos
          </Link>{' '}
          y el{' '}
          <Link href="/privacidad" className="underline">
            aviso de privacidad
          </Link>
          . Todavía no se publica nada: el perfil lo escribes en el paso
          siguiente.
        </p>
      </div>

      {/* Una salida de verdad, con su título y su botón. Antes era un enlace
          subrayado al final de la pantalla, debajo de todo lo que no le
          hacía falta leer a quien viene a pedir. */}
      <div className="mt-8 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">¿Vienes a pedir ayuda?</h2>
        <p className="mt-1 text-base text-muted-foreground">
          No necesitas cuenta ni dar tus datos. Publica qué te hace falta y
          quien pueda ayudarte responde con su contacto.
        </p>
        <Button
          variant="outline"
          className="mt-3"
          nativeButton={false}
          render={<Link href="/publicar" />}
        >
          <Plus className="size-5" aria-hidden="true" />
          Publicar una solicitud
        </Button>
      </div>

      {/* La tercera puerta. Se mencionaba solo dentro de
          /servicios/soy-proveedor, así que quien no tiene cuenta de Google
          —que es buena parte del rebusque, y a quien el módulo quiere
          incluir— llegaba aquí y se quedaba sin camino. Va como línea y no
          como tarjeta: es para pocos, y compitiendo con la salida de arriba
          confundía a quien solo venía a pedir. */}
      <p className="mt-6 text-base text-muted-foreground">
        ¿Vives de un oficio y no tienes cuenta de Google? Una organización
        aliada puede registrarte y darte un enlace propio para manejar tu
        ficha.{' '}
        <Link href="/servidores" className="underline">
          Cómo encontrarlas
        </Link>
      </p>
    </MarcoFlujo>
  )
}
