import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, MapPin, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { enlaceWhatsapp } from '@/lib/contacto'
import {
  DESLINDE_CALIDAD,
  NO_PAGUES_POR_ADELANTADO,
  SEGURIDAD_DOMICILIO,
  SOBRE_LAS_INSIGNIAS,
  SOBRE_LAS_RESENAS,
} from '@/lib/honestidad'
import {
  diasLegibles,
  etiquetaFranja,
  etiquetaMedioPago,
  etiquetaModalidad,
  precioLegible,
  zonaLegible,
} from '@/lib/servicios'
import { InsigniasProveedor } from '@/components/insignias-proveedor'
import { CriteriosResena } from '@/components/criterios-resena'
import { BotonReportar } from '@/components/boton-reportar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { FichaProveedor } from '@/lib/types'

export const metadata = { title: 'Ficha del proveedor' }

export default async function FichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Una sola llamada. `ficha_proveedor` lee de la vista pública, así que
  // la regla S y el filtro de suspendidos se aplican en un solo sitio y
  // esta pantalla no puede olvidarse de ninguno de los dos.
  const { data } = await supabase.rpc('ficha_proveedor', { p_id: id })
  const ficha = data as FichaProveedor | null
  if (!ficha) notFound()

  const { data: municipio } = await supabase
    .from('municipios')
    .select('nombre, departamento')
    .eq('codigo_dane', ficha.municipio)
    .maybeSingle()

  const zona = zonaLegible(ficha.zona_nombre, ficha.zona_texto)
  const dias = diasLegibles(ficha.dias)
  const aDomicilio = ficha.modalidad.includes('domicilio')

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/servicios" className="text-base underline underline-offset-4">
        ← Volver al directorio
      </Link>

      <h1 className="font-heading mt-3 text-3xl">{ficha.nombre_visible}</h1>

      <div className="mt-3">
        <InsigniasProveedor
          telefonoVerificado={ficha.telefono_verificado}
          referenciasConfirmadas={ficha.referencias_confirmadas}
          esMicroempresa={ficha.tipo === 'microempresa'}
          serviciosConfirmados={ficha.servicios_confirmados}
        />
      </div>

      {ficha.descripcion && <p className="mt-4 text-base">{ficha.descripcion}</p>}

      <h2 className="font-heading mt-6 text-2xl">Qué hace</h2>
      <ul className="mt-3 space-y-2">
        {ficha.oficios.map((o) => (
          <li
            key={o.oficio_id}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-border p-3"
          >
            <span className="text-base font-medium">{o.nombre}</span>
            <span className="text-base text-muted-foreground">
              {precioLegible(o.modo, o.precio_desde, o.unidad)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-6 space-y-3">
        <div className="flex items-start gap-2">
          <MapPin className="size-5 shrink-0 translate-y-0.5 text-muted-foreground" aria-hidden="true" />
          <div>
            <dt className="sr-only">Dónde atiende</dt>
            <dd className="text-base">
              {[zona, municipio?.nombre].filter(Boolean).join(' · ')}
              {municipio?.departamento ? `, ${municipio.departamento}` : ''}
            </dd>
            <dd className="text-sm text-muted-foreground">
              {ficha.modalidad.map(etiquetaModalidad).join(' · ')}
            </dd>
          </div>
        </div>

        {(dias || ficha.franjas.length > 0) && (
          <div className="flex items-start gap-2">
            <CalendarDays className="size-5 shrink-0 translate-y-0.5 text-muted-foreground" aria-hidden="true" />
            <div>
              <dt className="sr-only">Cuándo atiende</dt>
              <dd className="text-base">
                {[dias, ficha.franjas.map(etiquetaFranja).join(', ')]
                  .filter(Boolean)
                  .join(' · ')}
              </dd>
            </div>
          </div>
        )}

        {ficha.medios_pago.length > 0 && (
          <div className="flex items-start gap-2">
            <Wallet className="size-5 shrink-0 translate-y-0.5 text-muted-foreground" aria-hidden="true" />
            <div>
              <dt className="sr-only">Cómo recibe el pago</dt>
              <dd className="text-base">
                {ficha.medios_pago.map(etiquetaMedioPago).join(', ')}
              </dd>
              {/* Se dice aquí y no solo en los términos: es donde alguien
                  está a punto de acordar un pago. */}
              <dd className="text-sm text-muted-foreground">
                El pago se acuerda entre ustedes. AquíVe no lo recibe ni lo
                intermedia.
              </dd>
            </div>
          </div>
        )}
      </dl>

      {/* El aviso va pegado al botón, no al final de la página: en un
          teléfono el final de la página queda a varias pantallas de aquí.
          Mismo criterio que /servidores. */}
      <div className="mt-6 rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">{NO_PAGUES_POR_ADELANTADO}</p>
        {aDomicilio && (
          <p className="mt-2 text-sm text-muted-foreground">{SEGURIDAD_DOMICILIO}</p>
        )}
        <Button
          className="mt-3 w-full"
          nativeButton={false}
          render={
            <a
              href={enlaceWhatsapp(ficha.telefono)}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          Escribir por WhatsApp
        </Button>
        <Button
          variant="outline"
          className="mt-2 w-full"
          nativeButton={false}
          render={<a href={`tel:${ficha.telefono}`} />}
        >
          Llamar al {ficha.telefono}
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">
          <Link href="/seguridad" className="underline">
            Cómo cuidarte
          </Link>
        </p>
      </div>

      <h2 className="font-heading mt-8 text-2xl">Qué dice quien lo contrató</h2>

      {ficha.total_resenas === 0 ? (
        <p className="mt-3 text-base text-muted-foreground">
          Todavía no hay calificaciones. Eso no dice nada malo de esta persona:
          quiere decir que nadie ha usado su código de servicio todavía.
        </p>
      ) : (
        <>
          {/* Volumen antes que promedio: el número grande es cuántos
              servicios se confirmaron, no la nota. */}
          <p className="mt-3 text-base">
            <span className="text-2xl font-bold">{ficha.servicios_confirmados}</span>{' '}
            {ficha.servicios_confirmados === 1
              ? 'servicio confirmado'
              : 'servicios confirmados'}
            <span className="text-muted-foreground">
              {' · '}
              {ficha.total_resenas}{' '}
              {ficha.total_resenas === 1 ? 'calificación' : 'calificaciones'}
            </span>
          </p>

          <div className="mt-3">
            <CriteriosResena
              cumplimiento={ficha.cumplimiento}
              trato={ficha.trato}
              puntualidad={ficha.puntualidad}
            />
          </div>

          <ul className="mt-4 space-y-3">
            {ficha.resenas
              .filter((r) => r.comentario || r.replica)
              .map((r) => (
                <li key={r.id} className="rounded-lg border border-border p-3">
                  {r.comentario && <p className="text-base">{r.comentario}</p>}
                  {r.replica && (
                    <p className="mt-2 border-l-2 border-border pl-3 text-base text-muted-foreground">
                      <span className="font-medium">Respuesta de {ficha.nombre_visible}:</span>{' '}
                      {r.replica}
                    </p>
                  )}
                  <div className="mt-2">
                    <BotonReportar tipoObjeto="resena" objetoId={r.id} />
                  </div>
                </li>
              ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-sm text-muted-foreground">{SOBRE_LAS_RESENAS}</p>

      <Alert className="mt-6">
        <AlertDescription>
          {SOBRE_LAS_INSIGNIAS} {DESLINDE_CALIDAD}
        </AlertDescription>
      </Alert>

      <div className="mt-4">
        <BotonReportar tipoObjeto="proveedor" objetoId={ficha.id} />
      </div>
    </main>
  )
}
