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
 * WhatsApp ancho y llamar en un botón redondo al lado, no dos botones
 * iguales: casi todo el mundo escribe primero, y llamar es la excepción
 * —quien no tiene datos, quien tiene prisa—. Dos botones del mismo tamaño
 * obligan a leer para elegir algo que casi siempre es lo mismo.
 *
 * El texto completo de `NO_PAGUES_POR_ADELANTADO` y `SEGURIDAD_DOMICILIO`
 * no cabe en una barra y no se recorta: se queda arriba, en la ficha. Aquí
 * va la línea corta con su enlace a «Cómo cuidarte», que es lo que la regla
 * 5 pide de un aviso de encabezado.
 *
 * ⚠ Esto es SOLO el contenido de la barra: va como `accion` de
 * `MarcoFlujo`, que es quien la fija abajo y quien deja el hueco para que
 * no tape el final de la ficha. Antes se fijaba a sí misma, y dentro de una
 * hoja modal —donde el contenedor que scrollea no es el documento— eso la
 * dejaba flotando a media pantalla con la ficha pasándole por debajo.
 * Colocarse es trabajo del marco; esta barra solo sabe qué botones lleva.
 */
export function BarraContacto({ telefono }: { telefono: string }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Acuerda el precio antes de empezar y paga cuando el trabajo esté hecho.{' '}
        <Link href="/seguridad" className="underline">
          Cómo cuidarte
        </Link>
      </p>
      <div className="mt-2 flex items-center gap-3">
        <Button
          className="h-14 flex-1 text-lg"
          nativeButton={false}
          render={
            <a
              href={enlaceWhatsapp(telefono)}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <MessageCircle className="size-6" aria-hidden="true" />
          WhatsApp
        </Button>
        <a
          href={`tel:${telefono}`}
          aria-label={`Llamar al ${telefono}`}
          className="flex size-14 shrink-0 items-center justify-center rounded-full border border-enlace text-enlace transition-colors hover:bg-accent"
        >
          <Phone className="size-6" aria-hidden="true" />
        </a>
      </div>
    </>
  )
}
