import { headers } from 'next/headers'
import Link from 'next/link'
import { MessageSquare, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { horasParaVencer } from '@/lib/catalogo'
import type { SolicitudConRespuestas } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ActivarAvisos } from '@/components/activar-avisos'
import { PantallaConfirmacion } from './pantalla-confirmacion'
import { GestionSolicitud } from './gestion-solicitud'
import { ListaRespuestas } from './lista-respuestas'

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
        <h1 className="text-2xl font-bold">Solicitud no encontrada</h1>
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

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol =
    headersList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const link = `${protocol}://${host}/solicitud/${token}`

  const horasRestantes = Math.max(0, Math.round(horasParaVencer(solicitud.expira_at)))

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <PantallaConfirmacion link={link} codigo={solicitud.codigo} />

      <section className="mt-8">
        <h2 className="text-xl font-bold">Lo que pediste</h2>
        <div className="mt-2 rounded-lg border border-border p-4">
          <p className="text-base">
            {solicitud.barrio} · {solicitud.categoria}
          </p>
          <ul className="mt-2 space-y-1 text-base">
            {solicitud.items.map((it, i) => (
              <li key={i}>
                {it.cantidad} {it.unidad} de {it.nombre}
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
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <MessageSquare className="size-5" aria-hidden="true" />
          Respuestas ({solicitud.respuestas.length})
        </h2>

        {solicitud.respuestas.length > 0 && (
          <Alert variant="warning" className="mt-2">
            <AlertDescription className="text-amber-900">
              Tú decides a quién escribir. No compartas tu dirección hasta
              estar seguro. Nunca envíes dinero por adelantado.
            </AlertDescription>
          </Alert>
        )}

        <ListaRespuestas respuestas={solicitud.respuestas} />
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-bold">Avisos</h2>
        <ActivarAvisos token={token} />
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Administrar</h2>
        <GestionSolicitud token={token} />
      </section>
    </main>
  )
}
