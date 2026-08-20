import Link from 'next/link'
import { MessageCircle, Phone } from 'lucide-react'
import { enlaceWhatsapp } from '@/lib/contacto'
import { Button } from '@/components/ui/button'

/**
 * Contactar a un proveedor, en una barra fija abajo.
 *
 * Los dos botones estaban a media ficha de altura: quien baja a leer las
 * reseñas —que es exactamente quien está decidiendo— tenía que volver a
 * subir para escribir. Aquí están siempre, y el aviso corto va con ellos
 * porque es el momento en que se decide (regla 5).
 *
 * El texto completo de `NO_PAGUES_POR_ADELANTADO` y `SEGURIDAD_DOMICILIO`
 * no cabe en una barra y no se recorta: se queda arriba, en la ficha. Aquí
 * va la línea corta con su enlace a «Cómo cuidarte», que es lo que la regla
 * 5 pide de un aviso de encabezado.
 *
 * ⚠ Va fuera del encabezado, como `BarraInferior` y `AccionPrincipal`: el
 * `backdrop-filter` del encabezado convierte al elemento en bloque
 * contenedor de sus descendientes `fixed`.
 */
export function BarraContacto({ telefono }: { telefono: string }) {
  return (
    <>
      {/* En flujo, para que la barra no tape el final de la ficha. */}
      <div aria-hidden="true" className="h-36" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl px-4 py-2">
          <p className="text-sm text-muted-foreground">
            AquíVe no emplea ni recomienda a nadie. Acuerda el precio antes de
            empezar y no pagues por adelantado.{' '}
            <Link href="/seguridad" className="underline">
              Cómo cuidarte
            </Link>
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              className="flex-1"
              nativeButton={false}
              render={
                <a
                  href={enlaceWhatsapp(telefono)}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              nativeButton={false}
              render={<a href={`tel:${telefono}`} />}
            >
              <Phone className="size-5" aria-hidden="true" />
              Llamar
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
