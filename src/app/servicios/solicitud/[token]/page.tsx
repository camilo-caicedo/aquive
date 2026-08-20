import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NO_PAGUES_POR_ADELANTADO, SEGURIDAD_DOMICILIO } from '@/lib/honestidad'
import { URGENCIAS, zonaLegible } from '@/lib/servicios'
import { AccionesSolicitudServicio } from './acciones'
import { InsigniasProveedor } from '@/components/insignias-proveedor'
import { enlaceWhatsapp } from '@/lib/contacto'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { CapacidadPago, UrgenciaServicio } from '@/lib/types'

export const metadata = {
  title: 'Mi solicitud de servicio',
  // Lleva el token en el path. Que no lo indexe nadie.
  robots: { index: false, follow: false },
}

interface SolicitudServicio {
  id: string
  codigo: string
  oficio_nombre: string
  municipio: string
  zona_nombre: string | null
  zona_texto: string | null
  urgencia: UrgenciaServicio
  capacidad_pago: CapacidadPago
  nota: string | null
  estado: 'abierta' | 'resuelta'
  creada_at: string
  expira_at: string
  respuestas: {
    id: string
    mensaje: string
    creada_at: string
    proveedor_id: string
    proveedor_nombre: string
    telefono: string
    telefono_verificado: boolean
    servicios_confirmados: number
    referencias_confirmadas: number
  }[]
}

export default async function SolicitudServicioPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data } = await supabase.rpc('leer_solicitud_servicio', { p_token: token })
  const solicitud = (data as unknown as SolicitudServicio | null) ?? null

  if (!solicitud) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="font-heading text-3xl">No encontramos esa solicitud</h1>
        <p className="mt-3 text-base">
          El enlace puede estar incompleto, o la solicitud ya se borró —lo hace
          sola a los 15 días—. No podemos recuperarlo: no guardamos de quién es
          cada enlace, y esa es la razón por la que nadie más puede entrar al
          tuyo.
        </p>
        <Button className="mt-4" nativeButton={false} render={<Link href="/servicios/publicar" />}>
          Publicar otra
        </Button>
      </main>
    )
  }

  const { data: municipio } = await supabase
    .from('municipios')
    .select('nombre, departamento')
    .eq('codigo_dane', solicitud.municipio)
    .maybeSingle()

  const zona = zonaLegible(solicitud.zona_nombre, solicitud.zona_texto)
  const urgencia = URGENCIAS.find((u) => u.valor === solicitud.urgencia)?.etiqueta

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <p className="text-base text-muted-foreground">Solicitud</p>
      <h1 className="font-heading text-3xl">
        {solicitud.oficio_nombre}{' '}
        <span className="font-mono text-2xl text-muted-foreground">
          {solicitud.codigo}
        </span>
      </h1>

      <p className="mt-2 text-base text-muted-foreground">
        {[zona, municipio?.nombre].filter(Boolean).join(' · ')}
        {urgencia ? ` · ${urgencia}` : ''}
      </p>

      {solicitud.nota && <p className="mt-3 text-base">{solicitud.nota}</p>}

      {solicitud.estado === 'resuelta' && (
        <Alert className="mt-4">
          <AlertDescription>
            La marcaste como resuelta, así que ya no aparece en el tablero.
            Sigue aquí hasta que se borre sola.
          </AlertDescription>
        </Alert>
      )}

      <h2 className="font-heading mt-8 text-2xl">
        {solicitud.respuestas.length === 0
          ? 'Todavía nadie ha respondido'
          : solicitud.respuestas.length === 1
            ? 'Una persona respondió'
            : `${solicitud.respuestas.length} personas respondieron`}
      </h2>

      {solicitud.respuestas.length === 0 ? (
        <p className="mt-2 text-base text-muted-foreground">
          Cuando alguien responda vas a ver aquí su nombre y su teléfono, y tú
          decides a quién escribirle. Vuelve a este enlace para revisar.
        </p>
      ) : (
        <>
          <p className="mt-2 text-base text-muted-foreground">
            Tú eliges a quién escribirle. Nosotros no le dimos tu contacto a
            nadie: no lo tenemos.
          </p>

          <ul className="mt-4 space-y-3">
            {solicitud.respuestas.map((r) => (
              <li key={r.id} className="rounded-2xl bg-card p-4 shadow-sm">
                <Link
                  href={`/servicios/${r.proveedor_id}`}
                  className="text-lg font-bold underline-offset-4 hover:underline"
                >
                  {r.proveedor_nombre}
                </Link>

                <div className="mt-2">
                  <InsigniasProveedor
                    telefonoVerificado={r.telefono_verificado}
                    referenciasConfirmadas={r.referencias_confirmadas}
                    esMicroempresa={false}
                    serviciosConfirmados={r.servicios_confirmados}
                  />
                </div>

                <p className="mt-2 text-base">{r.mensaje}</p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="sm:flex-1"
                    nativeButton={false}
                    render={
                      <a
                        href={enlaceWhatsapp(r.telefono)}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    Escribir por WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    className="sm:flex-1"
                    nativeButton={false}
                    render={<a href={`tel:${r.telefono}`} />}
                  >
                    Llamar al {r.telefono}
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {/* Pegado a la lista, que es donde se decide. */}
          <p className="mt-4 text-sm text-muted-foreground">
            {NO_PAGUES_POR_ADELANTADO} {SEGURIDAD_DOMICILIO}{' '}
            <Link href="/seguridad" className="underline">
              Cómo cuidarte
            </Link>
          </p>
        </>
      )}

      <AccionesSolicitudServicio
        token={token}
        estado={solicitud.estado}
        dias={Math.max(
          0,
          Math.ceil((new Date(solicitud.expira_at).getTime() - Date.now()) / 86_400_000)
        )}
      />
    </main>
  )
}
