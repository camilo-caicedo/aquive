'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BadgeCheck,
  Phone,
  ChevronRight,
  PhoneCall,
  EyeOff,
  MapPin,
  Ban,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PanelZonas, type ZonaPropuesta } from '@/components/panel-zonas'

export interface PanelServiciosDatos {
  por_verificar: {
    id: string
    nombre_visible: string
    telefono: string
    municipio: string
    creado_at: string
    organizacion: string | null
    oficios_esperando: number
  }[]
  suspendidos: {
    id: string
    nombre_visible: string
    municipio: string
    actualizado_at: string
  }[]
  resenas_ocultas: {
    id: string
    proveedor_id: string
    proveedor_nombre: string
    comentario: string | null
    replica: string | null
    creada_at: string
  }[]
  referencias_pendientes: number
  zonas_pendientes: number
  totales: {
    proveedores: number
    publicados: number
    solicitudes: number
    servicios_confirmados: number
  }
}

export type ColaServicios = 'telefonos' | 'resenas' | 'zonas' | 'suspendidas'

/**
 * La moderación del módulo de Servicios.
 *
 * Antes eran seis secciones apiladas —cifras, teléfonos, reseñas ocultas,
 * suspendidas, zonas y la bitácora— y había que bajar por todas para
 * llegar a la última. Ahora son cuatro cifras arriba y una cola por fila
 * con su número, en el orden en que se atienden; abajo, la cola abierta.
 *
 * La bitácora se fue a su propia ruta y salió de aquí: estaba escondida
 * detrás de un botón, y un registro de accesos que nadie mira no disuade a
 * nadie.
 */
export function PanelServicios({
  datos,
  zonas,
  cola,
}: {
  datos: PanelServiciosDatos
  zonas: ZonaPropuesta[]
  cola: ColaServicios
}) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<string | null>(null)

  async function llamar(
    fn: 'verificar_telefono_proveedor' | 'suspender_proveedor' | 'ocultar_resena' | 'borrar_resena',
    args: Record<string, unknown>
  ) {
    setOcupado(true)
    setError(null)
    const supabase = createClient()
    // @ts-expect-error — el nombre de la RPC es dinámico y las cuatro
    // firmas son distintas; comprobarlo en el tipo no aporta nada aquí.
    const { error: rpcError } = await supabase.rpc(fn, args)
    setOcupado(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    router.refresh()
  }

  const COLAS: {
    clave: ColaServicios
    etiqueta: string
    cuantas: number
    Icono: typeof PhoneCall
  }[] = [
    {
      clave: 'telefonos',
      etiqueta: 'Teléfonos por verificar',
      cuantas: datos.por_verificar.length,
      Icono: PhoneCall,
    },
    {
      clave: 'resenas',
      etiqueta: 'Calificaciones ocultas',
      cuantas: datos.resenas_ocultas.length,
      Icono: EyeOff,
    },
    {
      clave: 'zonas',
      etiqueta: 'Zonas por revisar',
      cuantas: datos.zonas_pendientes,
      Icono: MapPin,
    },
    {
      clave: 'suspendidas',
      etiqueta: 'Fichas suspendidas',
      cuantas: datos.suspendidos.length,
      Icono: Ban,
    },
  ]

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section>
        <dl className="grid grid-cols-2 gap-2">
          {[
            ['Fichas', datos.totales.proveedores],
            ['Publicadas', datos.totales.publicados],
            ['Solicitudes vivas', datos.totales.solicitudes],
            ['Servicios confirmados', datos.totales.servicios_confirmados],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta as string} className="rounded-2xl bg-card p-3 shadow-canto">
              <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
              <dd className="text-2xl font-bold">{valor}</dd>
            </div>
          ))}
        </dl>
        {/* La diferencia entre fichas y publicadas es casi siempre la regla
            S haciendo su trabajo. Si nadie la explica, parece un error de
            conteo. */}
        {datos.totales.proveedores > datos.totales.publicados && (
          <p className="mt-2 text-sm text-muted-foreground">
            {datos.totales.proveedores - datos.totales.publicados} fichas no
            aparecen: están suspendidas, o todos sus oficios son de riesgo alto
            y les falta verificación o referencia.
          </p>
        )}
      </section>

      <nav aria-label="Colas de servicios">
        <ul className="space-y-2">
          {COLAS.map((c) => {
            const activa = cola === c.clave
            return (
              <li key={c.clave}>
                <Link
                  href={`/admin/servicios?cola=${c.clave}`}
                  aria-current={activa ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-2xl px-4 py-2.5 transition-colors ${
                    activa
                      ? 'border border-enlace/25 bg-accent text-accent-foreground'
                      : 'bg-card shadow-canto hover:bg-muted'
                  }`}
                >
                  <c.Icono
                    className={`size-5 shrink-0 ${activa ? '' : 'text-muted-foreground'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 text-base font-medium">{c.etiqueta}</span>
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      c.cuantas > 0
                        ? activa
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {c.cuantas}
                  </span>
                  {!activa && (
                    <ChevronRight
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {cola === 'telefonos' && (
        <section>
          <h2 className="font-heading text-2xl">Teléfonos por verificar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Llamar al número y confirmar que contesta esa persona. No hay otra
            forma: no hay OTP y no lo va a haber.
          </p>

          {datos.por_verificar.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nada pendiente.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {datos.por_verificar.map((p) => (
                <li key={p.id} className="rounded-2xl bg-card p-4 shadow-canto">
                  <Link
                    href={`/servicios/${p.id}`}
                    className="text-base font-bold underline-offset-4 hover:underline"
                  >
                    {p.nombre_visible}
                  </Link>
                  {p.organizacion && (
                    <p className="text-sm text-muted-foreground">
                      Registrada por {p.organizacion}
                    </p>
                  )}
                  {p.oficios_esperando > 0 && (
                    <p className="mt-1 text-sm text-accent-foreground">
                      {p.oficios_esperando === 1
                        ? 'Tiene un oficio de riesgo alto esperando.'
                        : `Tiene ${p.oficios_esperando} oficios de riesgo alto esperando.`}{' '}
                      Sin verificación y sin referencia confirmada, no se
                      publica.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="h-11 text-sm"
                      nativeButton={false}
                      render={<a href={`tel:${p.telefono}`} />}
                    >
                      <Phone className="size-4" aria-hidden="true" />
                      Llamar al {p.telefono}
                    </Button>
                    <Button
                      className="h-11 text-sm"
                      disabled={ocupado}
                      onClick={() =>
                        llamar('verificar_telefono_proveedor', {
                          p_proveedor_id: p.id,
                          p_verificado: true,
                        })
                      }
                    >
                      <BadgeCheck className="size-4" aria-hidden="true" />
                      Contestó
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-11 text-sm"
                      disabled={ocupado}
                      onClick={() =>
                        llamar('suspender_proveedor', {
                          p_proveedor_id: p.id,
                          p_suspendido: true,
                        })
                      }
                    >
                      Suspender
                    </Button>
                  </div>
                  {/* El botón dice lo que pasó, no lo que hace el sistema:
                      alguien llamó a ese número y contestó esa persona. */}
                  <p className="mt-2 text-sm text-muted-foreground">
                    «Contestó» significa que alguien llamó a ese número y
                    contestó esa persona. No dice nada más.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {cola === 'resenas' && (
        <section>
          <h2 className="font-heading text-2xl">Calificaciones ocultas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Están escondidas mientras se revisa un reporte. Volver a mostrarlas
            las devuelve a la ficha; borrarlas es definitivo, y es lo que
            corresponde cuando el reporte por amenaza o discriminación se
            confirma.
          </p>

          {datos.resenas_ocultas.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nada oculto.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {datos.resenas_ocultas.map((r) => (
                <li key={r.id} className="rounded-2xl bg-card p-4 shadow-canto">
                  <Link
                    href={`/servicios/${r.proveedor_id}`}
                    className="text-base font-bold underline-offset-4 hover:underline"
                  >
                    {r.proveedor_nombre}
                  </Link>
                  {r.comentario && <p className="mt-1 text-sm">«{r.comentario}»</p>}
                  {r.replica && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Respuesta: {r.replica}
                    </p>
                  )}

                  {/* Antes esto era un `confirm()` del navegador, el único
                      de la aplicación: mismo peso visual para «¿borrar una
                      calificación para siempre?» que para cualquier aviso
                      del sistema, y sin decir qué se pierde. */}
                  {borrando === r.id ? (
                    <>
                      <p className="mt-3 text-sm font-medium text-destructive">
                        ¿Seguro? Esto borra la calificación para siempre, con
                        su comentario y la respuesta del proveedor. No se puede
                        deshacer.
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className="h-11 text-sm"
                          disabled={ocupado}
                          onClick={() => setBorrando(null)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="destructive"
                          className="h-11 text-sm"
                          disabled={ocupado}
                          onClick={() => llamar('borrar_resena', { p_resena_id: r.id })}
                        >
                          {ocupado ? 'Borrando…' : 'Sí, borrar'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="h-11 text-sm"
                        disabled={ocupado}
                        onClick={() =>
                          llamar('ocultar_resena', { p_resena_id: r.id, p_oculta: false })
                        }
                      >
                        Volver a mostrar
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-11 text-sm"
                        disabled={ocupado}
                        onClick={() => setBorrando(r.id)}
                      >
                        Borrar
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {cola === 'zonas' && (
        <section>
          <h2 className="font-heading text-2xl">Zonas por revisar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Barrios y veredas que escribió alguien al registrarse, en
            municipios sin comunas cargadas. Al aprobarlos quedan en el
            desplegable para los siguientes.
          </p>
          <PanelZonas zonas={zonas} />
        </section>
      )}

      {cola === 'suspendidas' && (
        <section>
          <h2 className="font-heading text-2xl">Fichas suspendidas</h2>
          {datos.suspendidos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Ninguna.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {datos.suspendidos.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-3 shadow-canto"
                >
                  <span className="text-sm">{p.nombre_visible}</span>
                  <Button
                    variant="outline"
                    className="h-11 text-sm"
                    disabled={ocupado}
                    onClick={() =>
                      llamar('suspender_proveedor', {
                        p_proveedor_id: p.id,
                        p_suspendido: false,
                      })
                    }
                  >
                    Levantar la suspensión
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          {datos.referencias_pendientes === 0
            ? 'No hay referencias por comprobar.'
            : `${datos.referencias_pendientes} referencias por comprobar.`}{' '}
          Las comprueba el equipo de la fundación desde su panel, llamando.
          Administración solo ve la bitácora.
        </p>
        <Link
          href="/admin/bitacora?tipo=referencias"
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm underline underline-offset-4"
        >
          Quién ha leído referencias
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  )
}
