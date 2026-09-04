import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronDown, Mail, Phone } from 'lucide-react'

import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { ComoFunciona } from '@/components/como-funciona'
import { Button } from '@/components/ui/button'
import { CORREO_CONTACTO, RESPONSABLE } from '@/lib/config'
import { DESLINDE_CALIDAD, SI_ALGO_SALE_MAL, SOBRE_LAS_INSIGNIAS } from '@/lib/honestidad'

export const metadata: Metadata = {
  title: 'Preguntas frecuentes',
  description:
    'Lo que más nos preguntan sobre AquíVe, cómo poner una PQR y cómo escribirle al soporte.',
}

/**
 * Pantalla 37 · Preguntas frecuentes (antes «Ayuda»). La ruta sigue siendo
 * `/ayuda`: hay enlaces guardados apuntando ahí, y un 404 en una pantalla de
 * ayuda es peor que un nombre que no calza con la URL.
 *
 * Las preguntas van en `<details>` nativo, igual que en «Cómo funciona»:
 * las respuestas abiertas no caben en un teléfono, y plegarlas con la
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
 *
 * Las cinco preguntas de más abajo —qué se verifica, qué papel tiene la
 * fundación, cómo reportar, que no hay dinero de por medio— las pidió el
 * cliente sin texto nuevo que inventar: cada respuesta es un texto que ya
 * existe en `lib/honestidad.ts` (efecto legal, no se reescribe) o un dato ya
 * fijado en `lib/config.ts`.
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
    t: '¿Qué se verifica y qué significa un perfil verificado?',
    r: SOBRE_LAS_INSIGNIAS,
  },
  {
    t: '¿AquíVe recibe dinero o interviene en la transacción?',
    r: DESLINDE_CALIDAD,
  },
  {
    t: '¿Cuál es el papel de la Fundación?',
    r: `${RESPONSABLE} es la responsable del tratamiento de los datos de la plataforma. Es quien llama a verificar un teléfono, revisa una referencia y atiende la PQR de quien quiere ver, corregir o borrar lo suyo. AquíVe guarda los datos; quien decide para qué se usan es la fundación.`,
  },
  {
    t: 'Reportar a alguien',
    r: `${SI_ALGO_SALE_MAL} Y si alguien te pidió dinero por adelantado en nombre de AquíVe, o te llevó a otra página a pagar, repórtalo igual: no hace falta tener cuenta.`,
  },
]

export default function AyudaPage() {
  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Preguntas frecuentes" volver="/inicio" />

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
          className="pulsable shadow-canto mt-3 inline-flex min-h-12 items-center gap-2 rounded-full bg-card px-5 text-base font-semibold text-foreground"
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
