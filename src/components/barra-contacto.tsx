import Link from 'next/link'
import { ClipboardList, MessageCircle, Phone } from 'lucide-react'
import { enlaceWhatsapp } from '@/lib/contacto'
import { BotonChat } from '@/components/boton-chat'
import { Button } from '@/components/ui/button'

/**
 * Contactar a un proveedor, en una barra fija abajo.
 *
 * Los tres botones estaban a media ficha de altura: quien baja a leer las
 * reseñas —que es exactamente quien está decidiendo— tenía que volver a
 * subir para escribir. Aquí están siempre, y el aviso corto va con ellos
 * porque es el momento en que se decide (regla 5).
 *
 * ⚠ ADR 0015: «Pedir este servicio» pasa a ser la acción principal —la
 * única en lima (regla de interfaz 2)— porque es el flujo nuevo: una orden
 * que el prestador acepta o rechaza, con seguimiento en `/mis-solicitudes`.
 * WhatsApp y llamar se quedan visibles y sin relleno, no escondidos detrás
 * de un menú: el cliente insiste en que sigan a la vista para quien
 * prefiere resolverlo directo. Y cada uno dice qué va a pasar ANTES de
 * tocarlo —que WhatsApp abre WhatsApp, que llamar marca— para que nadie
 * toque un botón sin saber a dónde lo lleva.
 *
 * WhatsApp ancho y los otros dos en botones redondos al lado, no tres
 * botones iguales: casi todo el mundo escribe por WhatsApp primero, y los
 * otros dos son la excepción —quien tiene prisa llama, quien no quiere dar
 * su número escribe por aquí dentro—. Tres botones del mismo tamaño obligan
 * a leer para elegir algo que casi siempre es lo mismo.
 *
 * El chat de la ficha existe desde la corrección del ADR 0009. El hilo
 * cuelga de la ficha y muere con ella, igual que los otros dos orígenes:
 * borrarla borra sus hilos por `on delete cascade`.
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
export function BarraContacto({
  telefono,
  proveedorId,
  nombre,
}: {
  telefono: string
  proveedorId: string
  nombre: string
}) {
  return (
    <>
      <Button
        className="h-14 w-full text-lg"
        nativeButton={false}
        render={<Link href={`/servicios/publicar?proveedor=${proveedorId}`} />}
      >
        <ClipboardList className="size-6" aria-hidden="true" />
        Pedir este servicio
      </Button>

      <p className="mt-2 text-sm text-muted-foreground">
        Se lo mandas a {nombre} y te avisamos cuando responda. O contáctalo
        directo: WhatsApp abre la conversación fuera de AquíVe, y llamar marca
        de una vez.{' '}
        <Link href="/seguridad" className="underline">
          Cómo cuidarte
        </Link>
      </p>
      <div className="mt-2 flex items-center gap-3">
        <Button
          variant="outline"
          className="h-14 flex-1 text-lg"
          nativeButton={false}
          render={
            <a
              href={enlaceWhatsapp(telefono)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Escribir a ${nombre} por WhatsApp. Abre la aplicación de WhatsApp.`}
            />
          }
        >
          <MessageCircle className="size-6" aria-hidden="true" />
          WhatsApp
        </Button>
        <a
          href={`tel:${telefono}`}
          aria-label={`Llamar al ${telefono}. Marca el número directamente.`}
          className="pulsable flex size-14 shrink-0 items-center justify-center rounded-full border border-enlace text-enlace transition-colors hover:bg-accent"
        >
          <Phone className="size-6" aria-hidden="true" />
        </a>
        <BotonChat
          origen={{ tipo: 'ficha', id: proveedorId }}
          etiqueta={`Escribir por AquíVe a ${nombre}`}
          className="size-14 [&>svg]:size-6"
        />
      </div>
    </>
  )
}
