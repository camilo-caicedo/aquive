import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Mail } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { MarcoFlujo } from '@/components/marco-flujo'
import { BotonGoogle } from './boton-google'

/**
 * Pantalla 03. La puerta de la cuenta.
 *
 * ⚠ Es una puerta, no un peaje. Las dos salidas de abajo —«Seguir sin cuenta»
 * y «Alta con la fundación»— no son letra pequeña: buena parte del público
 * usa el sitio sin cuenta a propósito, y buena parte del rebusque no maneja
 * Google. Si alguna vez esta pantalla deja de ofrecerlas de forma visible,
 * deja de ser cierto que aquí se puede buscar y pedir sin registrarse.
 */
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
        Entra con tu cuenta de Google
      </h2>
      <p className="mt-2 text-base text-muted-foreground">
        Es el único acceso por ahora. Si es tu primera vez, la cuenta se crea
        sola; si ya entraste antes, vuelves a lo tuyo. Sin contraseña que
        recordar ni que perder.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            No se pudo iniciar sesión. Intenta de nuevo.
          </AlertDescription>
        </Alert>
      )}

      {/* Lo del correo va DENTRO de la tarjeta del botón, que es donde se
          decide, y no como un bloque de aviso suelto arriba (regla 5). */}
      <div className="shadow-canto mt-6 rounded-2xl bg-card p-4">
        <p className="flex items-start gap-2 text-base">
          <Mail className="size-5 shrink-0 translate-y-0.5 text-enlace" aria-hidden="true" />
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

      {/* Las dos salidas, juntas y con el mismo peso que la de arriba. El
          prototipo las agrupa bajo una pregunta, y con razón: quien llega
          aquí sin cuenta de Google necesita saber de una que no se ha
          equivocado de sitio. */}
      <section className="mt-8">
        <h2 className="font-heading text-xl">¿No tienes cuenta de Google?</h2>
        <p className="mt-1 text-base text-muted-foreground">
          No hace falta cuenta para buscar un servicio ni para pedir algo en el
          muro: eso funciona sin registro. Y si vas a ofrecer tu trabajo pero no
          manejas Google, la fundación te da de alta en persona.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="sm:flex-1"
            nativeButton={false}
            render={<Link href="/directorio" />}
          >
            Seguir sin cuenta
          </Button>
          <Button
            variant="outline"
            className="sm:flex-1"
            nativeButton={false}
            render={<Link href="/servidores" />}
          >
            Alta con la fundación
          </Button>
        </div>
      </section>

      <p className="mt-8 text-base">
        <Link href="/ayuda" className="text-enlace underline underline-offset-4">
          Ayuda con la plataforma
        </Link>
      </p>
    </MarcoFlujo>
  )
}
