import Link from 'next/link'
import { MessageSquare, PhoneCall } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearHoras } from '@/lib/tiempo'
import { categoria, describirItem } from '@/lib/catalogo'
import { AVISO_RESPONDER } from '@/lib/honestidad'
import { BadgeFrescura } from '@/components/badge-frescura'
import { BotonReportar } from '@/components/boton-reportar'
import { MarcoFlujo } from '@/components/marco-flujo'
import { PuertaCerrada } from '@/components/puerta-cerrada'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ContactoSolicitante, HiloResumen } from '@/lib/types'
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

  // ⚠ Ya no rebota mudo. Quien tocó «Puedo ayudar» en una solicitud
  // concreta perdía a dónde iba: volvía a la portada y tenía que buscar el
  // código otra vez. El destino se guarda en `sessionStorage` al salir
  // hacia Google —nunca en la URL, ver `src/lib/destino.ts`— y vuelve aquí.
  if (!user) {
    return (
      <MarcoFlujo titulo="Ofrecer ayuda" volver="/">
        <PuertaCerrada
          titulo="Para responder hace falta una cuenta"
          porque="Quien pidió esto va a ver tu nombre y tu contacto, así que hace falta una cuenta. Son dos minutos y se puede borrar en cualquier momento."
          seConserva={
            <>
              Guardamos a dónde ibas:{' '}
              <strong className="font-semibold">
                {categoria(solicitud.categoria).etiqueta} · {solicitud.barrio}
              </strong>
              . Al entrar vuelves aquí.
            </>
          }
          destino={`/responder/${codigo.toUpperCase()}`}
        />
      </MarcoFlujo>
    )
  }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('id, suspendido')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil) {
    return (
      <MarcoFlujo titulo="Ofrecer ayuda" volver="/">
        <PuertaCerrada
          titulo="Para responder necesitas un perfil"
          porque="Quien pidió va a ver tu nombre y tu contacto, así que hace falta una cuenta. Son dos minutos y se puede borrar en cualquier momento."
          seConserva={
            <>
              Guardamos a dónde ibas:{' '}
              <strong className="font-semibold">
                {categoria(solicitud.categoria).etiqueta} · {solicitud.barrio}
              </strong>
              . Al terminar vuelves aquí.
            </>
          }
          destino={`/responder/${codigo.toUpperCase()}`}
          href="/registro"
          etiqueta="Crear mi perfil"
        />
      </MarcoFlujo>
    )
  }

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

  // La logística, resuelta antes de escribir: lo que esta persona ya dijo
  // en su perfil precarga la casilla, y lo que dijo quien pidió evita que
  // se lo pregunten por chat. `puede_recoger` va por RPC y no en la vista
  // pública a propósito — ahí sería filtrable.
  const [{ data: yaRespondio }, { data: puedeTrasladarse }, { data: puedeRecoger }, { data: contactoData }] =
    await Promise.all([
      supabase
        .from('respuestas')
        .select('id')
        .eq('autor_id', user.id)
        .eq('solicitud_id', solicitud.id)
        .maybeSingle(),
      supabase.rpc('mi_movilidad'),
      supabase.rpc('movilidad_solicitud', { p_codigo: solicitud.codigo }),
      // Solo en el flujo directo: en el acompañado la fundación coordina
      // por chat a propósito, y este contacto no le compete a esa regla.
      solicitud.flujo === 'acompanado'
        ? Promise.resolve({ data: null })
        : supabase.rpc('contacto_solicitante', { p_codigo: solicitud.codigo }),
    ])
  const contacto = contactoData as unknown as ContactoSolicitante | null
  const hayContacto = !!(contacto?.nombre || contacto?.telefono || contacto?.correo)


  // Un solo aviso, entero, y pegado al botón que decide (regla 5). Antes
  // eran dos bloques encima del formulario: el de honestidad.ts y otro
  // reescrito a mano diciendo casi lo mismo, con la mitad del texto
  // hablándole de sí mismo a quien todavía no había decidido nada.
  const aviso =
    solicitud.flujo === 'acompanado' ? (
      <Alert className="mt-4">
        <AlertDescription>
          Esta solicitud la acompaña una fundación. La entrega es en su punto
          de acopio, no en la casa de nadie, y allá te van a pedir tu documento
          para dejar constancia de quién entregó qué — ese dato lo guarda la
          fundación, no nosotros.
          <br />
          Al ofrecer se abre una conversación entre los tres: tú, quien pidió y
          la fundación. No se intercambian teléfonos.
        </AlertDescription>
      </Alert>
    ) : (
      <Alert variant="warning" className="mt-4">
        <AlertDescription>
          {AVISO_RESPONDER}{' '}
          <Link href="/seguridad" className="underline">
            Cómo cuidarte
          </Link>
        </AlertDescription>
      </Alert>
    )

  return (
    <MarcoFlujo titulo="Ofrecer ayuda" volver="/">
      {/* En modo lectura: qué se pide, dónde y cuándo. El código va al
          final y en pequeño — sirve para nombrar la solicitud por teléfono,
          no para decidir. */}
      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-bold">
              {categoria(solicitud.categoria).etiqueta}
            </p>
            <p className="mt-0.5 text-base text-muted-foreground">
              {solicitud.municipio_nombre} · {solicitud.barrio} ·{' '}
              {formatearHoras(solicitud.horas_sin_confirmar)}
            </p>
          </div>
          <BadgeFrescura horas={solicitud.horas_sin_confirmar} />
        </div>

        {solicitud.items.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {solicitud.items.map((it, i) => (
              <li
                key={i}
                className="rounded-full bg-muted px-3.5 py-1.5 text-sm text-foreground"
              >
                {describirItem(it)}
              </li>
            ))}
          </ul>
        )}

        {solicitud.nota && <p className="mt-3 text-base">{solicitud.nota}</p>}

        <p className="mt-3 text-sm text-muted-foreground">
          {puedeRecoger === true ? 'Puede recoger · ' : ''}código{' '}
          <span className="font-mono">{solicitud.codigo}</span>
        </p>
      </div>

      {/* Contacto opcional que dejó quien pidió — excepción explícita a la
          regla 1 de CLAUDE.md, ver supabase/migraciones/v2-k4-contacto-solicitante.sql.
          Solo se muestra si esta persona lo dejó, y solo aquí: no sale en
          el tablero ni en ninguna otra pantalla. */}
      {hayContacto && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-accent p-4">
          <p className="flex items-center gap-2 text-base font-medium text-accent-foreground">
            <PhoneCall className="size-5 shrink-0" aria-hidden="true" />
            Dejó un contacto directo
          </p>
          <ul className="mt-1 space-y-0.5 text-base text-accent-foreground">
            {contacto?.nombre && <li>{contacto.nombre}</li>}
            {contacto?.telefono && <li>{contacto.telefono}</li>}
            {contacto?.correo && <li>{contacto.correo}</li>}
          </ul>
        </div>
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
          <p className="text-base text-foreground">
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
        <IniciarHilo codigo={solicitud.codigo} aviso={aviso} />
      ) : (
        <FormularioRespuesta
          aviso={aviso}
          codigo={solicitud.codigo}
          yaRespondio={!!yaRespondio}
          puedeTrasladarse={puedeTrasladarse === true}
          puedeRecoger={puedeRecoger === true}
        />
      )}
      {/* Reportar baja al final y en texto: es una salida, no una acción
          de esta pantalla, y arriba competía con el botón de ofrecer. */}
      <div className="mt-8 border-t border-border pt-4">
        <BotonReportar tipoObjeto="solicitud" objetoId={solicitud.id} />
      </div>
    </MarcoFlujo>
  )
}
