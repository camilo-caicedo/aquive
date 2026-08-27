import Link from 'next/link'
import { notFound } from 'next/navigation'

import { servidor } from '@/orpc/local'
import { NOMBRE_TIPO_PQR } from '@/contrato/pqr'
import { CORREO_HABEAS_DATA_SERVICIOS } from '@/lib/config'
import { MarcoFlujo } from '@/components/marco-flujo'

export const metadata = { title: 'Mi PQR', robots: { index: false, follow: false } }

/**
 * Consultar la propia con el código. Mínimo legal 3.
 *
 * ⚠ Esto **no existía**: `/pqr` entregaba un código «para cuando escribas
 * después» y no había ningún después. Escribir y no poder volver a mirar no
 * es un canal de habeas data, es un buzón sin fondo.
 *
 * Sin cuenta, y tiene que ser así (ADR 0006): condicionar un derecho con
 * plazo legal a tener cuenta de Google lo haría inejercible. El código va en
 * el path, nunca en query string (regla de producto 9), y de él en la base
 * solo vive el `sha256`.
 *
 * `robots: noindex` porque la URL lleva el código: no es un secreto que
 * proteja gran cosa, pero tampoco hay razón para que un buscador la guarde.
 */
export default async function MiPqrPage({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  const pqr = await servidor.pqr.porCodigo({ codigo: decodeURIComponent(codigo) })

  if (!pqr) notFound()

  const respondida = pqr.estado === 'respondida'

  return (
    <MarcoFlujo
      titulo={NOMBRE_TIPO_PQR[pqr.tipo]}
      subtitulo={`Escrita el ${new Date(pqr.creada_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`}
      volver="/pqr"
    >
      <div className="space-y-4">
        <section className="shadow-canto rounded-2xl bg-card p-4">
          <h2 className="font-heading text-lg leading-tight">{pqr.asunto}</h2>
          <p className="mt-2 text-base whitespace-pre-line">{pqr.detalle}</p>
        </section>

        {respondida ? (
          <section className="shadow-canto rounded-2xl bg-card p-4">
            {/* El estado no depende solo del color: lleva su palabra. */}
            <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
              Respondida
              {pqr.respondida_at &&
                ` el ${new Date(pqr.respondida_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`}
            </p>
            <p className="mt-2 text-base whitespace-pre-line">{pqr.respuesta}</p>
          </section>
        ) : (
          <section className="bg-accent text-accent-foreground rounded-2xl p-4">
            <p className="text-base font-semibold">Todavía sin responder</p>
            <p className="mt-1 text-base">
              El plazo es de {pqr.plazo_habil} días hábiles desde que la
              escribiste. Es el que fija la Ley 1581 de 2012, no un número
              nuestro.
            </p>
          </section>
        )}

        <p className="text-base text-muted-foreground">
          Guarda el enlace de esta página: es la única forma de volver. El
          código no se puede recuperar — de él solo guardamos una huella, no
          el código en sí.
        </p>

        <p className="text-base text-muted-foreground">
          Si perdiste el enlace o el plazo se venció, escribe a{' '}
          <Link
            href={`mailto:${CORREO_HABEAS_DATA_SERVICIOS}`}
            className="text-enlace underline underline-offset-4"
          >
            {CORREO_HABEAS_DATA_SERVICIOS}
          </Link>
          .
        </p>
      </div>
    </MarcoFlujo>
  )
}
