import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, MapPin, Wallet, ChevronDown, Info } from 'lucide-react'
import { servidor } from '@/orpc/local'
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
  precioDeProducto,
  precioLegible,
  zonaLegible,
} from '@/lib/servicios'
import { InsigniasProveedor } from '@/components/insignias-proveedor'
import { BarraContacto } from '@/components/barra-contacto'
import { BotonChat } from '@/components/boton-chat'
import { MarcoFlujo } from '@/components/marco-flujo'
import { CriteriosResena } from '@/components/criterios-resena'
import { BotonReportar } from '@/components/boton-reportar'

export const metadata = { title: 'Ficha del proveedor' }

export default async function FichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Una sola llamada, y por el contrato (ADR 0001, regla 2). La consulta lee
  // de `proveedores_publicos`, así que la regla de producto 7 y el filtro de
  // suspendidos se aplican en un solo sitio y esta pantalla no puede
  // olvidarse de ninguno de los dos.
  //
  // El municipio viene dentro: era una segunda consulta desde aquí, y la
  // aplicación de Expo habría tenido que acordarse de repetirla.
  const ficha = await servidor.servicios.ficha({ id })
  if (!ficha) notFound()

  // Lo que esta persona vende en «Hecho en el barrio». Va aparte de la
  // ficha y no dentro: un producto es de comunidad y un oficio de
  // servicios, y meterlos en la misma consulta uniría dos dominios que no
  // se necesitan. Después del  para no pedirlo si no hay ficha.
  const productos = await servidor.comunidad.productos({ proveedor: id })

  const municipio =
    ficha.municipio_nombre === null
      ? null
      : { nombre: ficha.municipio_nombre, departamento: ficha.municipio_departamento }

  const zona = zonaLegible(ficha.zona_nombre, ficha.zona_texto)
  const dias = diasLegibles(ficha.dias)
  const aDomicilio = ficha.modalidad.includes('domicilio')

  return (
    <MarcoFlujo
      titulo={ficha.nombre_visible}
      volver="/directorio"
      // La columna es nullable y el tipo escrito a mano decía que no. En
      // la práctica no pasa —la vista exige teléfono verificado, y no se
      // puede verificar un teléfono que no existe—, pero la ficha no se cae
      // por eso: se queda sin barra de contacto y ya.
      accion={
        ficha.telefono !== null ? <BarraContacto telefono={ficha.telefono} /> : undefined
      }
    >
      <div>
        {/* La explicación va pegada a las insignias, que es donde nace la
            duda. Al final de la página, a tres pantallas de aquí, no la
            leía quien acababa de ver un sello y se preguntaba qué
            significa. */}
        <InsigniasProveedor
          telefonoVerificado={ficha.telefono_verificado}
          referenciasConfirmadas={ficha.referencias_confirmadas}
          esMicroempresa={ficha.tipo === 'microempresa'}
          serviciosConfirmados={ficha.servicios_confirmados}
        />
      </div>

      <details className="group mt-4 rounded-2xl bg-card shadow-canto">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 text-base font-medium [&::-webkit-details-marker]:hidden">
          <Info className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1">Qué comprobamos y qué no</span>
          <ChevronDown
            className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-2 px-4 pb-4">
          <p className="text-base text-muted-foreground">{SOBRE_LAS_INSIGNIAS}</p>
          <p className="text-base text-muted-foreground">{DESLINDE_CALIDAD}</p>
        </div>
      </details>

      {ficha.descripcion && (
        <p className="mt-4 text-base text-muted-foreground">{ficha.descripcion}</p>
      )}

      <h2 className="font-heading mt-6 text-2xl font-extrabold tracking-tight">Qué hace</h2>
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

      {/* Lo que vende, debajo de lo que hace. Es la misma persona y el
          mismo trato —se acuerda por fuera, sin comisión—, así que no hace
          falta repetir el aviso: ya está arriba y en la barra de contacto.

          Sin productos no se dibuja la sección: un «no vende nada» no le
          sirve a nadie.

          Cada producto lleva su botón de chat. La ficha en sí no abre uno
          —una ficha no caduca, y un hilo colgado de ella no moriría nunca,
          ADR 0009— pero un producto sí, y es de lo que se quiere hablar.
          WhatsApp y llamar están en la barra de abajo, para toda la ficha. */}
      {productos.length > 0 && (
        <>
          <h2 className="font-heading mt-6 text-2xl font-extrabold tracking-tight">
            Qué vende
          </h2>
          <ul className="mt-3 space-y-2">
            {productos.map((p) => (
              <li
                key={p.id}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-base font-medium">{p.nombre}</span>
                    <span className="text-base text-muted-foreground">
                      {precioDeProducto(p.modo, p.precio_desde, p.unidad)}
                    </span>
                  </div>
                  {p.detalle && (
                    <p className="mt-1 text-sm text-muted-foreground">{p.detalle}</p>
                  )}
                </div>
                <BotonChat
                  origen={{ tipo: 'producto', id: p.id }}
                  etiqueta={`Escribir por AquíVe sobre ${p.nombre}`}
                />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">
            Aparece también en{' '}
            <Link href="/barrio" className="text-enlace underline underline-offset-4">
              Productos
            </Link>
            .
          </p>
        </>
      )}

      <dl className="mt-6 space-y-3">
        <div className="flex items-start gap-2">
          <MapPin className="size-5 shrink-0 translate-y-0.5 text-muted-foreground" aria-hidden="true" />
          <div>
            <dt className="sr-only">Dónde atiende</dt>
            <dd className="text-base text-muted-foreground">
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
              <dd className="text-base text-muted-foreground">
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
              <dd className="text-base text-muted-foreground">
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

      {/* Los textos largos se quedan aquí, donde hay sitio para leerlos;
          la línea corta y los dos botones van en la barra fija de abajo,
          que es donde se decide (regla 5). */}
      <div className="mt-6 rounded-xl bg-card p-4 shadow-canto">
        <p className="text-sm text-muted-foreground">{NO_PAGUES_POR_ADELANTADO}</p>
        {aDomicilio && (
          <p className="mt-2 text-sm text-muted-foreground">{SEGURIDAD_DOMICILIO}</p>
        )}
      </div>

      <h2 className="font-heading mt-8 text-2xl font-extrabold tracking-tight">Qué dice quien lo contrató</h2>

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
                <li key={r.id} className="rounded-2xl bg-card p-3 shadow-canto">
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

      <p className="mt-4 text-sm text-muted-foreground">
        {SOBRE_LAS_RESENAS}{' '}
        <Link href="/servicios/confirmar" className="underline">
          Tengo un código
        </Link>
      </p>

      <div className="mt-4">
        <BotonReportar tipoObjeto="proveedor" objetoId={ficha.id} />
      </div>

    </MarcoFlujo>
  )
}
