import type { Metadata } from 'next'
import Link from 'next/link'

import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Button } from '@/components/ui/button'
import { DESLINDE_CALIDAD } from '@/lib/honestidad'
import { RAZON_SOCIAL_RESPONSABLE, RESPONSABLE } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Quiénes somos',
  description:
    'De la emergencia del terremoto a la economía del rebusque: quién hace AquíVe y quién responde por los datos.',
}

/**
 * Pantalla 40 · Quiénes somos.
 *
 * Reescrita el 3 de septiembre de 2026 a pedido del cliente, en el orden que
 * pidió: el origen tras el terremoto, la transición de la emergencia a la
 * reactivación económica, Camilo como fundador, y el papel de Nodo Social,
 * la Fundación y los aliados.
 *
 * ⚠ NO INVENTA HECHOS. El responsable no dio fecha exacta de fundación,
 * apellido del fundador, ni qué aliados nombrar, así que esos huecos quedan
 * marcados con `// TODO cliente:` en vez de rellenos con algo que suene bien.
 * Una página institucional de una fundación real con datos inventados es
 * peor que una incompleta. La lista completa de lo que falta preguntar va al
 * final de esta tarea, no en el código.
 *
 * Lo único fechado que se afirma —el terremoto del 10 de agosto de 2026— no
 * es un dato nuevo: ya es el que usan `components/pie-de-pagina.tsx` y
 * `components/como-funciona.tsx` para la misma ayuda de emergencia, así que
 * repetirlo aquí no es inventar, es no contradecirlos.
 *
 * ⚠ El bloque «Quién responde por los datos» es el mismo de antes de esta
 * reescritura, palabra por palabra: la pieza jurídica que distingue
 * responsable de encargada (mínimo legal, `/privacidad`) no se toca por
 * gusto de prosa.
 */
export default function QuienesSomosPage() {
  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Quiénes somos" volver="/inicio" />

      <section>
        <h2 className="font-heading text-2xl">Cómo empezó</h2>
        <p className="mt-3 max-w-prose text-base">
          AquíVe nació después del terremoto del 10 de agosto de 2026, para
          conectar rápido a quien necesitaba algo con quien tenía cómo
          dárselo: agua, comida, un techo por unos días. De ahí salió lo que
          hoy es la aplicación.
        </p>
        {/* TODO cliente: contar el origen de verdad —dónde se armó la
            primera versión, quién ayudó los primeros días, qué tan rápido
            se hizo—. Aquí solo va lo que ya está confirmado en el resto de
            la aplicación: la fecha del terremoto y que la respuesta fue
            insumos. */}
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-2xl">De la emergencia al rebusque</h2>
        <p className="mt-3 max-w-prose text-base">
          Pasado lo más urgente, quedó una pregunta distinta: mucha de la
          gente que ayudó, y mucha que necesitó ayuda, vive del rebusque de
          todos los días —el oficio, el arreglo, la changa— y no tenía cómo
          hacerse encontrar. AquíVe se fue moviendo de atender la emergencia a
          sostener esa economía local: hoy el directorio de servicios recibe
          a quien entra, y la emergencia sigue viva un paso más atrás, no
          desapareció.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-2xl">Quién la empezó</h2>
        <p className="mt-3 max-w-prose text-base">
          La idea es de Camilo.
        </p>
        {/* TODO cliente: nombre completo del fundador, y qué contar de él
            —por qué la empezó, qué hacía antes—. No se publica un apellido
            ni una historia que el responsable no haya confirmado. */}
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-2xl">Nodo Social, la Fundación y los aliados</h2>
        <p className="mt-3 max-w-prose text-base">
          {RESPONSABLE} opera AquíVe sin ánimo de lucro. {DESLINDE_CALIDAD}
        </p>
        <p className="mt-3 max-w-prose text-base">
          Los centros de acopio los llevan organizaciones aliadas: gente de la
          zona que presta un lugar físico para recibir y entregar donaciones,
          y que un administrador da de alta después de revisar su certificado
          y su NIT. Puedes ver los que ya están publicados en{' '}
          <Link href="/aliados" className="text-enlace underline underline-offset-4">
            «Aliados»
          </Link>
          .
        </p>
        {/* TODO cliente: si hay aliados concretos que el responsable quiera
            nombrar o destacar aquí (no solo enlazar a /aliados), decir
            cuáles. Sin eso, esta sección no nombra ninguno por su cuenta. */}
      </section>

      <h2 className="font-heading mt-8 text-2xl">Quién responde por los datos</h2>
      <p className="mt-3 max-w-prose text-base">
        {RAZON_SOCIAL_RESPONSABLE || RESPONSABLE} es responsable del
        tratamiento; AquíVe es encargada. Eso importa cuando quieras corregir
        o borrar algo tuyo: hay a quién escribirle.
      </p>
      <p className="mt-3">
        <Link
          href="/privacidad"
          className="inline-flex min-h-12 items-center text-base text-enlace underline underline-offset-4"
        >
          Leer el aviso de privacidad
        </Link>
      </p>

      <div className="mt-6">
        <Button className="w-full sm:w-auto" nativeButton={false} render={<Link href="/inicio" />}>
          Volver al inicio
        </Button>
      </div>
    </main>
  )
}
