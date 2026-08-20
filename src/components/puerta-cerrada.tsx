import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Una pantalla que pide cuenta, en vez de un `redirect` mudo.
 *
 * Tres rutas rebotaban a `/login` o a `/registro` sin decir nada:
 * `/responder/[codigo]` sin perfil, `/servicios/soy-proveedor` sin sesión y
 * `/unirse` sin sesión. Quien venía de tocar «Puedo ayudar» en una
 * solicitud concreta aterrizaba en una pantalla de login que no mencionaba
 * la solicitud, y al entrar caía en la portada.
 *
 * Las tres dicen ahora lo mismo, en este orden: por qué hace falta cuenta,
 * qué se conserva de donde estabas, y cuál es la salida si no la quieres.
 */
export function PuertaCerrada({
  titulo,
  porque,
  seConserva,
  destino,
  href = '/login',
  etiqueta = 'Entrar con Google',
  alternativa,
}: {
  titulo: string
  /** Por qué hace falta cuenta. Nunca «por seguridad». */
  porque: string
  /** Qué se guarda de donde estaba. */
  seConserva?: string
  /** A dónde vuelve al terminar. Viaja como `?volver=`, y se valida. */
  destino?: string
  href?: string
  etiqueta?: string
  alternativa?: string
}) {
  const url = destino ? `${href}?volver=${encodeURIComponent(destino)}` : href

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <h2 className="font-heading text-2xl">{titulo}</h2>
      <p className="mt-2 text-base text-muted-foreground">{porque}</p>
      {seConserva && <p className="mt-2 text-base text-ok">{seConserva}</p>}

      <Button className="mt-4 w-full" nativeButton={false} render={<Link href={url} />}>
        <LogIn className="size-5" aria-hidden="true" />
        {etiqueta}
      </Button>

      {alternativa && (
        <p className="mt-3 text-sm text-muted-foreground">{alternativa}</p>
      )}

      {/* La salida. Quien viene a pedir ayuda no necesita nada de esto. */}
      <p className="mt-4 border-t border-border pt-3 text-base">
        <Link href="/publicar" className="underline">
          Vengo a pedir ayuda, no a ofrecer
        </Link>
      </p>
    </div>
  )
}
