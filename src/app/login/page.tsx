import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, LifeBuoy, Mail } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
      <h2 className="font-heading text-4xl leading-[1.05]">
        Entra con
        <br />
        tu cuenta
        <br />
        de Google
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
      <div className="mt-7">
        <BotonGoogle destino={volver} />

        <p className="mt-4 flex items-start gap-2 text-base text-muted-foreground">
          <Mail className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
          <span>
            <strong className="text-foreground font-semibold">
              No guardamos tu correo.
            </strong>{' '}
            De tu cuenta de Google conservamos un identificador interno y nada
            más. No lo leemos, no lo guardamos y no queda en ningún registro.
          </span>
        </p>

        <p className="mt-2 text-base text-muted-foreground">
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
      <section className="bg-accent text-accent-foreground mt-8 rounded-2xl p-5">
        <h2 className="font-heading text-xl">¿No tienes cuenta de Google?</h2>
        <p className="mt-2 text-base">
          No hace falta cuenta para buscar un servicio ni para pedir algo en el
          muro: eso funciona sin registro. Y si vas a ofrecer tu trabajo pero no
          manejas Google, la fundación te da de alta en persona.
        </p>
        {/* La primera en píldora blanca —es la salida que más gente usa— y
            la segunda como enlace: es para pocos, y con dos botones iguales
            quien solo venía a mirar dudaba cuál era el suyo. */}
        <Link
          href="/inicio"
          className="shadow-canto mt-4 inline-flex min-h-12 items-center rounded-full bg-card px-5 text-base font-semibold"
        >
          Seguir sin cuenta
        </Link>

        <p className="mt-4">
          <Link
            href="/entidades"
            className="text-foreground min-h-12 text-base font-medium underline underline-offset-4"
          >
            Alta con la fundación
          </Link>
        </p>
      </section>

      {/* Fila con canto, no un enlace suelto: es un destino, y a esta altura
          de la pantalla un subrayado se pierde. */}
      <Link
        href="/ayuda"
        className="shadow-canto mt-4 flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-card px-5"
      >
        <span className="flex items-center gap-3 text-base font-medium">
          <LifeBuoy className="size-5 shrink-0" aria-hidden="true" />
          Ayuda con la plataforma
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </MarcoFlujo>
  )
}
