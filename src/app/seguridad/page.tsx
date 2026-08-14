import Link from 'next/link'
import { ShieldAlert, Phone } from 'lucide-react'
import { AVISO_CORTO, CONSEJOS } from '@/lib/honestidad'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Cómo cuidarte · AquíVe' }

export default function SeguridadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <ShieldAlert className="size-6 shrink-0" aria-hidden="true" />
        Cómo cuidarte
      </h1>

      <p className="mt-3 max-w-prose text-base">
        {AVISO_CORTO} Cualquiera puede publicar una solicitud sin dar sus
        datos, y cualquiera con una cuenta de Google puede responder. Eso es
        lo que hace que la plataforma sirva rápido, y también lo que hace que
        estos cinco consejos importen.
      </p>

      <ul className="mt-6 space-y-4">
        {CONSEJOS.map((c, i) => (
          <li key={c.titulo} className="rounded-xl border border-border bg-card p-4">
            <h2 className="flex items-start gap-2 text-lg font-bold">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-base text-accent-foreground"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              {c.titulo}
            </h2>
            <p className="mt-2 text-base text-muted-foreground">{c.texto}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-xl font-bold">Sobre los profesionales</h2>
      <p className="mt-2 max-w-prose text-base text-muted-foreground">
        A quien se registra como profesional le revisamos que su número de
        matrícula aparezca en el registro de su entidad —COPNIA, CPNAA,
        ReTHUS y las demás—. Eso es todo lo que dice el sello: que el número
        existe. No verificamos su identidad, ni su experiencia, ni sus
        intenciones. Un perfil sin ese sello no ha sido revisado en absoluto.
      </p>

      <h2 className="mt-8 text-xl font-bold">Si algo sale mal</h2>
      <p className="mt-2 max-w-prose text-base text-muted-foreground">
        Cada solicitud, cada respuesta y cada perfil tienen un botón para
        reportar. Lo revisa una persona y puede borrar el contenido o
        suspender la cuenta. Si hay riesgo para alguien ahora mismo, eso no
        es un reporte: es el 123.
      </p>

      <Alert variant="warning" className="mt-4">
        <AlertDescription className="text-amber-900">
          Nadie de AquíVe te va a pedir dinero, ni tus claves, ni el enlace
          de tu solicitud. Si alguien lo hace diciendo que es de la
          plataforma, está mintiendo.
        </AlertDescription>
      </Alert>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          nativeButton={false}
          render={<a href="tel:123" />}
        >
          <Phone className="size-5" aria-hidden="true" />
          Llamar al 123
        </Button>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          nativeButton={false}
          render={<Link href="/terminos" />}
        >
          Leer los términos
        </Button>
      </div>
    </main>
  )
}
