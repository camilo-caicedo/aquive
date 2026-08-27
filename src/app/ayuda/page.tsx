import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronDown, Mail, Phone } from 'lucide-react'

import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { ComoFunciona } from '@/components/como-funciona'
import { Button } from '@/components/ui/button'
import { CORREO_CONTACTO } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Ayuda',
  description:
    'Lo que más nos preguntan sobre AquíVe, cómo poner una PQR y cómo escribirle al soporte.',
}

/**
 * Pantalla 37 · Ayuda.
 *
 * Las preguntas van en `<details>` nativo, igual que en «Cómo funciona»:
 * cinco respuestas abiertas no caben en un teléfono, y plegarlas con la
 * etiqueta del navegador sale gratis en JavaScript, en teclado y en lector
 * de pantalla.
 *
 * Una sola acción lima (regla 2): poner una PQR. Escribir al soporte es la
 * salida rápida para lo que no es una PQR, y va en secundario.
 *
 * El bloque del 123 es el mismo de `/seguridad`, palabra por palabra. Está
 * duplicado a propósito y no extraído a un componente: son dos pantallas
 * que hoy dicen lo mismo, y si un día una de las dos cambia de texto, el
 * componente compartido sería lo primero que estorbaría.
 */

const PREGUNTAS: { t: string; r: string }[] = [
  {
    t: '¿Cómo publico mi oficio?',
    r: 'Entra con tu cuenta de Google y llena tu ficha: tus oficios, los municipios y zonas donde trabajas, y tu teléfono. Si no tienes cuenta de Google, alguien de la fundación puede registrarte y te entrega un código con el que después ves, corriges y borras tu ficha por tu cuenta.',
  },
  {
    t: '¿Cómo se acuerdan los pagos?',
    r: 'Entre ustedes dos y por fuera de la aplicación. AquíVe no cobra comisión, no recibe pagos y no tiene pasarela: los precios que ves en una ficha son información, no un cobro. Acuerda el valor antes de empezar y paga cuando el trabajo esté hecho.',
  },
  {
    t: '¿Qué pasa si cancelo un servicio?',
    r: 'No pasa nada en la plataforma: no hay penalización ni cobro, porque no hay dinero de por medio. Avísale a la otra persona por el mismo canal por el que hablaron. Si ya te dieron un código de servicio y el trabajo no se hizo, no lo uses para calificar.',
  },
  {
    t: '¿Por qué uno de mis oficios no aparece?',
    r: 'Hay oficios que no salen en el directorio hasta que una persona de la fundación te llame para verificar tu teléfono y compruebe una referencia tuya. Son el cuidado de niños, el cuidado de personas dependientes y el transporte de pasajeros. No es un error ni una demora: mientras falte una de las dos cosas, ese oficio no se muestra.',
  },
  {
    t: 'Reportar a alguien',
    r: 'En la ficha de cada persona hay un botón para reportarla, y no hace falta tener cuenta. Si alguien te pidió dinero por adelantado en nombre de AquíVe, o te llevó a otra página a pagar, repórtalo ahí mismo. Si lo que hay es riesgo para alguien en este momento, eso no es un reporte: es el 123.',
  },
]

export default function AyudaPage() {
  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Ayuda con la plataforma" />

      <p className="max-w-prose text-base text-muted-foreground">
        Esto es lo que más nos preguntan. Si lo tuyo no está aquí, escríbenos
        o pon una PQR y te respondemos.
      </p>

      <ul className="revelar mt-6 space-y-3">
        {PREGUNTAS.map((p) => (
          <li key={p.t}>
            <details className="group shadow-canto rounded-2xl bg-card">
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 text-lg font-semibold">{p.t}</span>
                <ChevronDown
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="px-4 pt-1 pb-4 text-base text-muted-foreground">{p.r}</p>
            </details>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          className="w-full sm:w-auto"
          nativeButton={false}
          render={<Link href="/pqr" />}
        >
          Poner una PQR
        </Button>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          nativeButton={false}
          render={<a href={`mailto:${CORREO_CONTACTO}`} />}
        >
          <Mail className="size-5" aria-hidden="true" />
          Escribir al soporte
        </Button>
      </div>

      {/* El otro extremo, en rojo pastel con texto negro (5,67:1): esto no
          es una línea de atención, y decirlo tarde no sirve de nada. */}
      <div className="mt-6 rounded-2xl bg-familia-rojo p-4 text-foreground">
        <p className="font-heading text-base">Si hay riesgo para alguien ahora</p>
        <p className="mt-2 text-base">
          Eso no es un reporte: es el <strong>123</strong>. AquíVe no atiende
          urgencias ni rescates.
        </p>
        <a
          href="tel:123"
          className="shadow-canto mt-3 inline-flex min-h-12 items-center gap-2 rounded-full bg-card px-5 text-base font-semibold text-foreground"
        >
          <Phone className="size-5" aria-hidden="true" />
          Llamar al 123
        </a>
      </div>

      <nav className="mt-8 border-t border-border pt-4" aria-label="Más información">
        <ul className="space-y-1">
          <li>
            <Link
              href="/seguridad"
              className="inline-flex min-h-12 items-center text-base text-enlace underline underline-offset-4"
            >
              Cómo cuidarte
            </Link>
          </li>
          <li>
            <Link
              href="/contacto"
              className="inline-flex min-h-12 items-center text-base text-enlace underline underline-offset-4"
            >
              Contacto
            </Link>
          </li>
        </ul>
      </nav>

      {/* La explicación larga, que antes era su propia pantalla. Va DEBAJO
          de las preguntas cortas a propósito: quien llega con una duda
          concreta la resuelve arriba sin bajar, y quien quiere entender el
          sitio entero sigue leyendo. */}
      <ComoFunciona />
    </main>
  )
}
