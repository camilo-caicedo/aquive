import Link from 'next/link'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Estado } from '@/components/estado'

// ⚠ Este mismo texto vale para «no existe» y para «no es tuyo». Contestar
// «no tienes permiso» diría que ese recurso existe, y con un token en la
// dirección eso convierte la pantalla en un oráculo.
export default function NoEncontrado() {
  return (
    <main className="animar-pantalla mx-auto max-w-lg px-4 py-12">
      <Estado
        Icono={Compass}
        titulo="Esta página no existe"
        detalle="Puede que el enlace esté mal escrito, o que la solicitud ya se haya borrado. Las solicitudes se borran solas a las 72 horas."
        accion={
          <>
            <Button nativeButton={false} render={<Link href="/ayudas" />}>
              Ver solicitudes abiertas
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/publicar" />}>
              Publicar una solicitud
            </Button>
          </>
        }
      />
    </main>
  )
}
