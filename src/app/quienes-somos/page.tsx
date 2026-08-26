import type { Metadata } from 'next'
import Link from 'next/link'

import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Button } from '@/components/ui/button'
import { RAZON_SOCIAL_RESPONSABLE, RESPONSABLE } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Quiénes somos',
  description:
    'Un directorio hecho entre vecinos: sin comisiones, sin plan pago y con una confianza que se puede mirar.',
}

/**
 * Pantalla 40 · Quiénes somos.
 *
 * Los tres puntos van sobre relleno de familia con texto encima, nunca con
 * el color como letra: sobre crema, el amarillo y el verde dan 1,35 y 2,98
 * (ADR 0002). Blanco sobre azul da 6,31 y negro sobre los otros dos, 10,38
 * y 6,56.
 *
 * ⚠ El punto 2 NO dice «sostenida por donaciones», que es lo que dibujaba
 * el prototipo. La plataforma no recibe dinero en ninguna forma —regla dura
 * 5, y el plan Hobby de Vercel cuenta las donaciones como uso comercial—,
 * así que anunciarlo sería anunciar algo que no puede pasar.
 *
 * ⚠ El bloque de datos es jurídico y va literal: distingue responsable de
 * encargada, que es el reparto que explica `/privacidad`. No se reescribe
 * para que suene mejor.
 */

const PUNTOS: { n: string; titulo: string; texto: string; clase: string }[] = [
  {
    n: '01',
    titulo: 'Gratis para quien ofrece',
    texto:
      'Publicar un oficio no cuesta nada, hoy ni después. No hay plan pago ni posiciones destacadas: quien aparece arriba está ahí por lo que hace y por dónde trabaja, no por lo que pagó.',
    clase: 'bg-familia-azul text-card',
  },
  {
    n: '02',
    titulo: 'Sin dinero de por medio',
    texto:
      'AquíVe no cobra comisión, no recibe pagos y no tiene pasarela. Lo que acuerdes se lo pagas directamente a quien hace el trabajo, por fuera de la aplicación.',
    clase: 'bg-familia-amarillo text-foreground',
  },
  {
    n: '03',
    titulo: 'Confianza que se puede mirar',
    texto:
      'Teléfono llamado por una persona, referencias comprobadas y códigos de servicio. Ninguna insignia dice «confiable»: cada una dice exactamente qué se comprobó y quién lo comprobó.',
    clase: 'bg-familia-verde text-foreground',
  },
]

export default function QuienesSomosPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Un directorio hecho entre vecinos" />

      <p className="max-w-prose text-base">
        Nacimos de una idea simple: en cada barrio ya existe quien sabe hacer
        lo que otro necesita. La aplicación solo pone a esas dos personas en
        contacto, sin comisiones por servicio.
      </p>

      <ol className="mt-6 space-y-4">
        {PUNTOS.map((p) => (
          <li key={p.n} className={`rounded-2xl p-4 ${p.clase}`}>
            <p className="font-mono text-sm" aria-hidden="true">
              {p.n}
            </p>
            <h2 className="font-heading mt-1 text-xl">{p.titulo}</h2>
            <p className="mt-2 text-base">{p.texto}</p>
          </li>
        ))}
      </ol>

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
