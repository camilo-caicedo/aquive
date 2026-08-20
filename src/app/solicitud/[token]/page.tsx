import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { origenDelSitio } from '@/lib/origen'
import { horasParaVencer, describirItem, categoria } from '@/lib/catalogo'
import type { ConversacionDelSolicitante, SolicitudConRespuestas } from '@/lib/types'
import type { AliadoDelMunicipio } from '@/lib/acompanamiento'
import { Button } from '@/components/ui/button'
import { Chat } from '@/components/chat'
import { Pestanas } from '@/components/pestanas'
import { CintaEnlace } from '@/components/cinta-enlace'
import { ActivarAvisos } from '@/components/activar-avisos'
import { Acompanamiento } from './acompanamiento'
import { ConfirmarRecepcion } from './confirmar-recepcion'
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

type Vista = 'enlace' | 'respuestas' | 'coordinacion' | 'ajustes'

export default async function SolicitudPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ ver?: string }>
}) {
  const { token } = await params
  const { ver } = await searchParams
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
  const acompanada = solicitud.flujo === 'acompanado'
  const numRespuestas = solicitud.respuestas.length

  // La pestaña por defecto cambia según el momento, y esa es la decisión
  // que más importa de esta pantalla: recién publicada, lo único que hay
  // que hacer es guardar el enlace — si se pierde, se pierde la solicitud.
  // En cuanto alguien responde, lo que se viene a ver son las respuestas.
  // Ya no hay pestaña de enlace: el enlace vive en la cinta fija de
  // arriba, visible siempre y no solo mientras no hubiera respuestas.
  const porDefecto: Vista = 'respuestas'
  const vista: Vista =
    ver === 'respuestas' || ver === 'ajustes' || ver === 'enlace'
      ? ver
      : ver === 'coordinacion' && acompanada
        ? 'coordinacion'
        : porDefecto

  const base = `/solicitud/${token}`

  // Cada pestaña pide lo suyo. Las fundaciones solo hacen falta en la de
  // respuestas: el ofrecimiento principal vive en el paso 4 de publicar, y
  // esto es la segunda oportunidad para quien dijo que no. Los hilos solo
  // existen si está acompañada.
  const [{ data: aliadosData }, { data: hilosData }] = await Promise.all([
    vista === 'respuestas' && !acompanada
      ? supabase.rpc('aliados_del_municipio', { p_municipio: solicitud.municipio })
      : Promise.resolve({ data: null }),
    vista === 'coordinacion' && acompanada
      ? supabase.rpc('mis_conversaciones_token', { p_token: token })
      : Promise.resolve({ data: null }),
  ])

  const aliados = (aliadosData as unknown as AliadoDelMunicipio[] | null) ?? []
  const hilos = (hilosData as unknown as ConversacionDelSolicitante[]) ?? []
  const horasRestantes = Math.max(0, Math.round(horasParaVencer(solicitud.expira_at)))

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      {/* La llave de la solicitud, fija y siempre visible: perderla es
          perder la solicitud, y antes vivía en una pestaña que se dejaba de
          ver justo cuando la persona empezaba a entrar todos los días. */}
      <CintaEnlace
        link={`${await origenDelSitio()}${base}`}
        codigo={solicitud.codigo}
        token={token}
      />

      {/* Lo que pediste va arriba de todo y fuera de las pestañas: es la
          respuesta a «¿esta es mi solicitud?», y hay que poder contestarla
          sin navegar. Ocupa cuatro líneas. */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-lg font-bold">{categoria(solicitud.categoria).etiqueta}</span>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-4" aria-hidden="true" />
            {horasRestantes > 0
              ? `Se borra sola en ${horasRestantes} ${horasRestantes === 1 ? 'hora' : 'horas'}`
              : 'Está por borrarse'}
          </span>
        </div>
        <p className="mt-1 text-base">{solicitud.barrio}</p>
        <ul className="mt-2 space-y-1 text-base text-muted-foreground">
          {solicitud.items.map((it, i) => (
            <li key={i}>{describirItem(it)}</li>
          ))}
        </ul>
        {solicitud.nota && (
          <p className="mt-2 text-base text-muted-foreground">{solicitud.nota}</p>
        )}
      </div>

      <div className="mt-4">
        <Pestanas
          etiqueta="Secciones de tu solicitud"
          pestanas={[
            {
              href: `${base}?ver=respuestas`,
              etiqueta: 'Respuestas',
              activa: vista === 'respuestas',
              cuenta: numRespuestas,
            },
            ...(acompanada
              ? [
                  {
                    href: `${base}?ver=coordinacion`,
                    etiqueta: 'Coordinación',
                    activa: vista === 'coordinacion',
                  },
                ]
              : []),
            {
              href: `${base}?ver=ajustes`,
              etiqueta: 'Ajustes',
              activa: vista === 'ajustes',
            },
          ]}
        />
      </div>

      {vista === 'enlace' && numRespuestas === 0 && (
        <section className="mt-6">
          <PantallaConfirmacion
            token={token}
            yaTieneAvisos={solicitud.tiene_avisos}
            link={`${await origenDelSitio()}${base}`}
            codigo={solicitud.codigo}
            sinRespuestas={numRespuestas === 0}
          />
        </section>
      )}

      {vista === 'respuestas' && (
        <section className="mt-6">
          <ListaRespuestas respuestas={solicitud.respuestas} />

          {/* El ofrecimiento de acompañamiento vive aquí y no en una pestaña
              propia: es una decisión que se toma mirando las respuestas —o
              la falta de ellas—, no un trámite aparte. */}
          <Acompanamiento
            token={token}
            aliados={aliados}
            flujo={solicitud.flujo}
            organizacion={solicitud.organizacion}
          />
        </section>
      )}

      {vista === 'coordinacion' && (
        <section className="mt-6 space-y-4">
          {hilos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-base text-muted-foreground">
              Todavía no hay ninguna conversación. Aparecen cuando alguien
              ofrece ayuda o cuando la fundación se organiza para entregarte.
            </p>
          ) : (
            hilos.map((h) => (
              <div key={h.id}>
                <p className="mb-2 text-base text-muted-foreground">
                  {h.directa ? (
                    <>
                      {h.aliado ?? 'La fundación'} va a entregarte esto
                      directamente
                    </>
                  ) : (
                    <>
                      {h.ofertador ?? 'Alguien'} ofreció ayuda
                      {h.aliado
                        ? ` · ${h.aliado} coordina`
                        : ' · falta que la fundación se haga cargo'}
                    </>
                  )}
                </p>
                <Chat
                  conversacionId={h.id}
                  token={token}
                  estado={h.estado}
                  miRol="solicitante"
                  acopio={h.acopio}
                  mensajesIniciales={h.mensajes}
                />

                {/* La segunda confirmación. Aparece cuando la fundación ya
                    registró la entrega, que es cuando hay algo que
                    confirmar. */}
                {h.estado === 'entregada' && (
                  <ConfirmarRecepcion token={token} conversacionId={h.id} />
                )}
              </div>
            ))
          )}
        </section>
      )}

      {vista === 'ajustes' && (
        <>
          <section className="mt-6 space-y-3">
            <h2 className="font-heading text-2xl">Avisos</h2>
            <ActivarAvisos token={token} yaTieneAvisos={solicitud.tiene_avisos} />
          </section>

          <section className="mt-8">
            <h2 className="font-heading text-2xl">Administrar</h2>
            <GestionSolicitud token={token} />

            {/* Solo en Flujo 2: en Flujo 1 no hay nada que consultar, y
                ofrecer una pantalla de «tus datos» donde no guardamos
                ninguno haría dudar de lo único que hay que creerse. */}
            {acompanada && (
              <p className="mt-3 text-base">
                <Link href={`/mis-datos/${token}`} className="underline">
                  Ver qué datos tuyos guardamos, y borrarlos
                </Link>
              </p>
            )}
          </section>
        </>
      )}
    </main>
  )
}
