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
        detalle="Puede que el enlace esté mal escrito, o que lo que buscabas ya se haya borrado."
        accion={
          <Button nativeButton={false} render={<Link href="/inicio" />}>
            Ir al inicio
          </Button>
        }
      />
    </main>
  )
}
