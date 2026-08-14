import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageSquare, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { horasParaVencer, describirItem, categoria } from '@/lib/catalogo'
import type { SolicitudConRespuestas } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ActivarAvisos } from '@/components/activar-avisos'
import type { AliadoDelMunicipio } from '@/lib/acompanamiento'
import { Acompanamiento } from './acompanamiento'
import { PantallaConfirmacion } from './pantalla-confirmacion'
import { GestionSolicitud } from './gestion-solicitud'
import { ListaRespuestas } from './lista-respuestas'

// El token portador va en la URL, así que esta página no se indexa nunca.
// `robots.ts` ya pide lo mismo, pero un `Disallow` es una petición que
// solo respeta quien quiere: esto va en la respuesta y sirve también para
// quien llegue por un enlace compartido en un chat que previsualiza.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function SolicitudPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('leer_solicitud', { p_token: token })

  if (error || !data) {
    return (
      <main className="mx-auto max-w-lg px-4 py-6 text-center">
        <h1 className="font-heading text-3xl">Solicitud no encontrada</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Este enlace no existe, ya venció (72 horas) o fue borrado. No es
          posible recuperar una solicitud perdida.
        </p>
        <Button className="mt-4 w-full" nativeButton={false} render={<Link href="/publicar" />}>
          Publicar una solicitud nueva
        </Button>
      </main>
    )
  }

  const solicitud = data as unknown as SolicitudConRespuestas

  // Solo se pregunta si todavía no hay acompañamiento: si ya lo tiene, la
  // organización viene con la solicitud y esta consulta sobra.
  const { data: aliadoData } =
    solicitud.flujo === 'directo'
      ? await supabase.rpc('aliado_en_municipio', { p_municipio: solicitud.municipio })
      : { data: null }
  const aliado = (aliadoData as unknown as AliadoDelMunicipio | null) ?? null

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol =
    headersList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const link = `${protocol}://${host}/solicitud/${token}`

  const horasRestantes = Math.max(0, Math.round(horasParaVencer(solicitud.expira_at)))

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <PantallaConfirmacion
        link={link}
        codigo={solicitud.codigo}
        sinRespuestas={solicitud.respuestas.length === 0}
      />

      <section className="mt-8">
        <h2 className="font-heading text-2xl">Lo que pediste</h2>
        <div className="mt-2 rounded-lg border border-border p-4">
          <p className="text-base">
            {solicitud.barrio} · {categoria(solicitud.categoria).etiqueta}
          </p>
          <ul className="mt-2 space-y-1 text-base">
            {solicitud.items.map((it, i) => (
              <li key={i}>
                {describirItem(it)}
              </li>
            ))}
          </ul>
          {solicitud.nota && (
            <p className="mt-2 text-base text-muted-foreground">{solicitud.nota}</p>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-4" aria-hidden="true" />
            {horasRestantes > 0
              ? `Se borra sola en ${horasRestantes} ${horasRestantes === 1 ? 'hora' : 'horas'}`
              : 'Está por borrarse'}
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-heading flex items-center gap-2 text-2xl">
          <MessageSquare className="size-5" aria-hidden="true" />
          Respuestas ({solicitud.respuestas.length})
        </h2>

        <ListaRespuestas respuestas={solicitud.respuestas} />
      </section>

      {/* Después de las respuestas y antes de los avisos: quien entra a esta
          pantalla viene a ver si alguien le respondió, no a que le pidan
          datos. El enlace está, pero no primero. */}
      <Acompanamiento
        token={token}
        aliado={aliado}
        flujo={solicitud.flujo}
        organizacion={solicitud.organizacion}
      />

      <section className="mt-8 space-y-3">
        <h2 className="font-heading text-2xl">Avisos</h2>
        <ActivarAvisos token={token} />
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-2xl">Administrar</h2>
        <GestionSolicitud token={token} />
      </section>
    </main>
  )
}
