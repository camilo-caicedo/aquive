import Link from 'next/link'
import { IdCard } from 'lucide-react'

import { MarcoFlujo } from '@/components/marco-flujo'
import { Button } from '@/components/ui/button'

/**
 * Lo que se ve al abrir una pantalla del carné sin tener carné.
 *
 * ⚠ Sustituye a seis `redirect('/servicios/soy-proveedor')` idénticos, uno
 * en cada subpantalla del perfil. Aquel rebote llevaba a una pantalla
 * titulada «Arma tu carné» sin explicar por qué: tocabas «Mis datos y
 * contacto» y aterrizabas en un formulario de alta. Era el fallo que más se
 * notaba de todos.
 *
 * Desde el ADR 0015 estas filas ni siquiera se dibujan sin ficha, así que
 * aquí se llega por una dirección escrita a mano o guardada — que es justo
 * el caso en el que un rebote mudo desconcierta más.
 *
 * Es el criterio que ya dejó escrito `barrio/mios/page.tsx`: decir por qué,
 * en vez de rebotar.
 */
export function SinCarne({
  titulo,
  porque,
}: {
  /** El mismo título que tendría la pantalla. Quien llega sabe a qué venía. */
  titulo: string
  /** Qué necesita el carné para esto en concreto. Nunca «por seguridad». */
  porque: string
}) {
  return (
    <MarcoFlujo titulo={titulo} volver="/perfil">
      <div className="shadow-cartel-amarillo rounded-2xl bg-card p-5">
        <span className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-full">
          <IdCard className="size-6" aria-hidden="true" />
        </span>
        <h2 className="font-heading mt-3 text-2xl leading-tight">
          Esto es de tu carné, y todavía no lo tienes
        </h2>
        <p className="mt-2 text-base text-muted-foreground">{porque}</p>
        <Button
          className="mt-4 w-full"
          nativeButton={false}
          render={<Link href="/servicios/soy-proveedor" />}
        >
          Armar mi carné
        </Button>
      </div>

      <p className="mt-4 text-base text-muted-foreground">
        Tu cuenta está completa: puedes buscar, pedir y escribir sin carné. El
        carné es solo para aparecer en el directorio.
      </p>
    </MarcoFlujo>
  )
}
