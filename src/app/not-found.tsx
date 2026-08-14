import Link from 'next/link'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NoEncontrado() {
  return (
    <main className="mx-auto max-w-lg px-4 py-12 text-center">
      <Compass className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="font-heading mt-4 text-3xl">Esta página no existe</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Puede que el enlace esté mal escrito, o que la solicitud ya se haya
        borrado. Las solicitudes se borran solas a las 72 horas.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button nativeButton={false} render={<Link href="/" />}>
          Ver solicitudes abiertas
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/publicar" />}>
          Publicar una solicitud
        </Button>
      </div>
    </main>
  )
}
