import { notFound } from 'next/navigation'

import { servidor } from '@/orpc/local'
import { createClient } from '@/lib/supabase/server'
import { MarcoFlujo } from '@/components/marco-flujo'
import { PuertaCerrada } from '@/components/puerta-cerrada'
import { FormularioResponder } from './formulario-responder'

export const metadata = { title: 'Yo puedo ayudar' }

/**
 * Responder una solicitud de insumos.
 *
 * ⚠ Esta ruta **no existía**. El botón «Puedo ayudar» del tablero
 * (`src/components/tarjeta-solicitud.tsx`) apuntaba aquí, y la campana de
 * avisos también: los dos daban 404 desde el ADR 0006, que borró la versión
 * por token. La mitad «quien puede, responde» del módulo de insumos llevaba
 * semanas sin entrada, con la RPC funcionando detrás y nadie que la llamara.
 *
 * El código va en el path, no en query string (regla de producto 9). No es
 * un secreto —está impreso en el tablero público— pero la costumbre se
 * sostiene o no se sostiene.
 *
 * Sin sesión no rebota a `/login`: explica y ofrece entrar, conservando a
 * dónde volver. Es la misma regla que siguen `/perfil` y el chat.
 */
export default async function ResponderPage({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const solicitud = await servidor.insumos.porCodigo({ codigo })
  if (!solicitud) notFound()

  const destino = `/responder/${solicitud.codigo}`

  if (!user) {
    return (
      <MarcoFlujo titulo="Yo puedo ayudar" volver="/ayudas">
        <PuertaCerrada
          titulo="Para responder hace falta una cuenta"
          porque="Quien pidió tiene que poder escribirte, y para eso tu teléfono público va con la respuesta. Sin cuenta no hay dónde guardarlo ni forma de saber que quien vuelve mañana eres tú."
          seConserva={`Al entrar vuelves a la solicitud ${solicitud.codigo}.`}
          destino={destino}
          alternativa="Si prefieres no crear cuenta, en los centros de acopio se recibe sin registrarse."
        />
      </MarcoFlujo>
    )
  }

  return (
    <MarcoFlujo
      titulo="Yo puedo ayudar"
      subtitulo={`${solicitud.codigo} · ${[solicitud.barrio, solicitud.municipio_nombre].filter(Boolean).join(' · ')}`}
      volver="/ayudas"
    >
      <FormularioResponder solicitud={solicitud} />
    </MarcoFlujo>
  )
}
