import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatearHoras } from '@/lib/tiempo'
import { describirItem } from '@/lib/catalogo'
import { AVISO_RESPONDER } from '@/lib/honestidad'
import { BadgeFrescura } from '@/components/badge-frescura'
import { BotonReportar } from '@/components/boton-reportar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FormularioRespuesta } from './formulario-respuesta'

export default async function ResponderPage({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  const supabase = await createClient()

  const { data: solicitud } = await supabase
    .from('solicitudes_publicas')
    .select('*')
    .eq('codigo', codigo.toUpperCase())
    .maybeSingle()

  if (!solicitud) {
    return (
      <main className="mx-auto max-w-lg px-4 py-6 text-center">
        <h1 className="text-2xl font-bold">Solicitud no disponible</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Ya fue atendida, venció o el código no existe.
        </p>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />} className="mt-4">
          Ver otras solicitudes
        </Button>
      </main>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('id, suspendido')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil) redirect('/registro')

  const { data: yaRespondio } = await supabase
    .from('respuestas')
    .select('id')
    .eq('autor_id', user.id)
    .eq('solicitud_id', solicitud.id)
    .maybeSingle()

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xl font-bold">{solicitud.codigo}</span>
          <BadgeFrescura horas={solicitud.horas_sin_confirmar} />
        </div>
        <p className="mt-1 text-base">
          {solicitud.municipio_nombre} — {solicitud.barrio}
        </p>
        {solicitud.items.length > 0 && (
          <ul className="mt-3 space-y-1 text-base">
            {solicitud.items.map((it, i) => (
              <li key={i}>
                {describirItem(it)}
              </li>
            ))}
          </ul>
        )}
        {solicitud.nota && (
          <p className="mt-3 text-base text-muted-foreground">{solicitud.nota}</p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          {formatearHoras(solicitud.horas_sin_confirmar)}
        </p>

        {/* La otra mitad del recorrido, y también un paso irreversible:
            aquí se entrega nombre real y teléfono a alguien anónimo, y
            después se va a un encuentro físico. Una solicitud falsa para
            cosechar teléfonos es el fraude obvio de este flujo. */}
        <p className="mt-3 text-sm text-muted-foreground">
          {AVISO_RESPONDER}{' '}
          <Link href="/seguridad" className="underline">
            Cómo cuidarte
          </Link>
        </p>

        <div className="mt-3">
          <BotonReportar tipoObjeto="solicitud" objetoId={solicitud.id} />
        </div>
      </div>

      <Alert variant="warning" className="mt-4">
        <AlertDescription className="text-amber-900">
          Tu nombre y tu contacto público se muestran a quien publicó la
          solicitud. Esa persona decide si te escribe: la plataforma no tiene
          su teléfono ni le envía mensajes por ti.
        </AlertDescription>
      </Alert>

      {perfil.suspendido ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            Tu perfil está suspendido y no puede responder solicitudes.
          </AlertDescription>
        </Alert>
      ) : (
        <FormularioRespuesta codigo={solicitud.codigo} yaRespondio={!!yaRespondio} />
      )}
    </main>
  )
}
