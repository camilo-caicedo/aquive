import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearHoras } from '@/lib/tiempo'
import { describirItem } from '@/lib/catalogo'
import { AVISO_RESPONDER } from '@/lib/honestidad'
import { BadgeFrescura } from '@/components/badge-frescura'
import { BotonReportar } from '@/components/boton-reportar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { HiloResumen } from '@/lib/types'
import { FormularioRespuesta } from './formulario-respuesta'
import { IniciarHilo } from './iniciar-hilo'

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
        <h1 className="font-heading text-3xl">Solicitud no disponible</h1>
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

  // Si ya hay conversacion abierta sobre esta solicitud, esta pantalla no
  // tiene que pedir otra vez lo mismo: tiene que llevar al hilo. Se busca
  // por código entre los hilos propios — `mis_hilos` ya los trae.
  const { data: hilosData } =
    solicitud.flujo === 'acompanado'
      ? await supabase.rpc('mis_hilos')
      : { data: null }
  const miHilo = ((hilosData as unknown as HiloResumen[]) ?? []).find(
    (h) => h.codigo === solicitud.codigo && h.soy_ofertador
  )

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

      {/* Las dos mitades del proyecto, y aquí se ve la diferencia entera.
          En el Flujo 1 la plataforma se aparta y el contacto ocurre por
          fuera. En el Flujo 2 no hay contacto por fuera: se coordina aquí,
          con la fundación delante, y por eso el aviso es otro. */}
      {solicitud.flujo === 'acompanado' ? (
        <Alert className="mt-4">
          <AlertDescription>
            Esta solicitud la acompaña una fundación. La entrega es en su
            punto de acopio, no en la casa de nadie, y allá te van a pedir tu
            documento para dejar constancia de quién entregó qué — ese dato lo
            guarda la fundación, no nosotros.
            <br />
            Al ofrecer se abre una conversación entre los tres: tú, quien pidió
            y la fundación. No se intercambian teléfonos.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            Tu nombre y tu contacto público se muestran a quien publicó la
            solicitud. Esa persona decide si te escribe: la plataforma no tiene
            su teléfono ni le envía mensajes por ti.
          </AlertDescription>
        </Alert>
      )}

      {perfil.suspendido ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            Tu perfil está suspendido y no puede responder solicitudes.
          </AlertDescription>
        </Alert>
      ) : miHilo ? (
        /* Ya hay hilo: pedirle otra vez que cuente en qué puede ayudar
           sería hacerle repetir lo que ya escribió. Lo que hace falta es
           llevarlo a la conversación, que vive en su panel. */
        <div className="mt-4 rounded-xl border border-ok/30 bg-ok-suave p-4">
          <p className="text-base text-ok">
            Ya estás en la conversación de esta solicitud
            {miHilo.aliado
              ? `, con ${miHilo.aliado} de la fundación.`
              : '. Falta que alguien de la fundación se haga cargo.'}
          </p>
          <Button
            className="mt-3 w-full"
            nativeButton={false}
            render={<Link href="/aliado" />}
          >
            <MessageSquare className="size-5" aria-hidden="true" />
            Ir a la conversación
          </Button>
        </div>
      ) : solicitud.flujo === 'acompanado' ? (
        <IniciarHilo codigo={solicitud.codigo} />
      ) : (
        <FormularioRespuesta codigo={solicitud.codigo} yaRespondio={!!yaRespondio} />
      )}
    </main>
  )
}
