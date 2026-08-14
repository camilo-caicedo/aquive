import Link from 'next/link'
import { ShieldAlert, Phone } from 'lucide-react'
import {
  AVISO_TABLERO,
  CONSEJOS,
  NADIE_TE_PIDE,
  SI_ALGO_SALE_MAL,
  SOBRE_LOS_PROFESIONALES,
} from '@/lib/honestidad'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Cómo cuidarte · AquíVe' }

export default function SeguridadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading flex items-center gap-2 text-3xl">
        <ShieldAlert className="size-6 shrink-0" aria-hidden="true" />
        Cómo cuidarte
      </h1>

      <p className="mt-3 max-w-prose text-base">
        {AVISO_TABLERO} Cualquiera puede publicar una solicitud sin dar sus
        datos, y cualquiera con una cuenta de Google puede responder. Eso es
        lo que hace que la plataforma sirva rápido, y también lo que hace que
        estos consejos importen — vayas a pedir o a ofrecer.
      </p>

      <ul className="mt-6 space-y-4">
        {CONSEJOS.map((c, i) => (
          <li key={c.titulo} className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-heading flex items-start gap-2 text-xl">
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

      <h2 className="font-heading mt-8 text-2xl">Sobre los profesionales</h2>
      <p className="mt-2 max-w-prose text-base text-muted-foreground">
        {SOBRE_LOS_PROFESIONALES}
      </p>

      <h2 className="font-heading mt-8 text-2xl">Si algo sale mal</h2>
      <p className="mt-2 max-w-prose text-base text-muted-foreground">
        {SI_ALGO_SALE_MAL}
      </p>

      <Alert variant="warning" className="mt-4">
        <AlertDescription>{NADIE_TE_PIDE}</AlertDescription>
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
