import Link from 'next/link'
import { SOBRE_LAS_RESENAS } from '@/lib/honestidad'
import { MarcoFlujo } from '@/components/marco-flujo'
import { FormularioConfirmar } from './formulario-confirmar'

export const metadata = { title: 'Calificar un servicio' }

/**
 * Aquí se escribe el código a mano, y no hay otra puerta.
 *
 * No hay enlace que lo lleve, no hay QR y no hay path que lo contenga
 * (regla 6). Quien tiene el código lo recibió del proveedor en un papel o
 * por WhatsApp, y esa es toda la cadena: es lo que hace que una
 * calificación cueste un servicio y no un clic.
 */
export default function ConfirmarPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

  return (
    <MarcoFlujo titulo="Calificar un trabajo" volver="/servicios">
      {/* Sin introducción: quien llega aquí ya tiene el papel en la mano.
          Lo que hacía falta decir —que no pide cuenta y que el código sirve
          una vez— se dice bajo el campo y al final, no antes de él. */}
      <FormularioConfirmar turnstileSiteKey={siteKey} />

      <p className="mt-8 text-sm text-muted-foreground">{SOBRE_LAS_RESENAS}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        ¿No tienes código?{' '}
        <Link href="/servicios" className="underline">
          Vuelve al directorio
        </Link>
        . Y si alguien te pidió plata a cambio de una buena calificación, o te
        amenazó con una mala, repórtalo desde su ficha.
      </p>
    </MarcoFlujo>
  )
}
