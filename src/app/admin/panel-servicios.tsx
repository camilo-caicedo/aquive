'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BadgeCheck, Eye, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

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
  totales: {
    proveedores: number
    publicados: number
    solicitudes: number
    servicios_confirmados: number
  }
}

export interface AccesoAReferencia {
  id: string
  referencia_ref: string
  existe_todavia: boolean
  lector_ref: string
  rol_lector: string
  motivo: string
  leida_at: string
}

/**
 * El panel de moderación del módulo de Servicios.
 *
 * Tres colas y una bitácora. La bitácora se muestra aunque nadie la pida:
 * un registro de accesos que nunca se mira no disuade a nadie, y es la
 * evidencia de diligencia frente a la fundación y frente a la SIC.
 */
export function PanelServicios({
  datos,
  accesos,
}: {
  datos: PanelServiciosDatos
  accesos: AccesoAReferencia[]
}) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verBitacora, setVerBitacora] = useState(false)

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

  return (
    <div className="mt-6 space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section>
        <h2 className="font-heading text-2xl">Cómo va</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          {[
            ['Fichas', datos.totales.proveedores],
            ['Publicadas', datos.totales.publicados],
            ['Solicitudes vivas', datos.totales.solicitudes],
            ['Servicios confirmados', datos.totales.servicios_confirmados],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta as string} className="rounded-lg border border-border p-3">
              <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
              <dd className="text-2xl font-bold">{valor}</dd>
            </div>
          ))}
        </dl>
        {/* La diferencia entre fichas y publicadas es casi siempre la
            regla S haciendo su trabajo. Si nadie la explica, parece un
            error de conteo. */}
        {datos.totales.proveedores > datos.totales.publicados && (
          <p className="mt-2 text-sm text-muted-foreground">
            {datos.totales.proveedores - datos.totales.publicados} fichas no
            aparecen en el directorio: están suspendidas, o todos sus oficios
            son de riesgo alto y les falta verificación o referencia.
          </p>
        )}
      </section>

      <section>
        <h2 className="font-heading text-2xl">
          Teléfonos por verificar ({datos.por_verificar.length})
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          Llamar al número y confirmar que contesta esa persona. No hay otra
          forma: no hay OTP y no lo va a haber.
        </p>

        {datos.por_verificar.length === 0 ? (
          <p className="mt-3 text-base text-muted-foreground">Nada pendiente.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {datos.por_verificar.map((p) => (
              <li key={p.id} className="rounded-lg border border-border p-4">
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
                    Sin verificación y sin referencia confirmada, no se publican.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<a href={`tel:${p.telefono}`} />}
                  >
                    <Phone className="size-4" aria-hidden="true" />
                    Llamar al {p.telefono}
                  </Button>
                  <Button
                    disabled={ocupado}
                    onClick={() =>
                      llamar('verificar_telefono_proveedor', {
                        p_proveedor_id: p.id,
                        p_verificado: true,
                      })
                    }
                  >
                    <BadgeCheck className="size-4" aria-hidden="true" />
                    Contestó: verificar
                  </Button>
                  <Button
                    variant="ghost"
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
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-heading text-2xl">
          Calificaciones ocultas ({datos.resenas_ocultas.length})
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          Están escondidas mientras se revisa un reporte. Levantar la
          ocultación las devuelve a la ficha; borrarlas es definitivo, y es lo
          que corresponde cuando el reporte por amenaza o discriminación se
          confirma.
        </p>

        {datos.resenas_ocultas.length === 0 ? (
          <p className="mt-3 text-base text-muted-foreground">Nada oculto.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {datos.resenas_ocultas.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-4">
                <Link
                  href={`/servicios/${r.proveedor_id}`}
                  className="text-base font-bold underline-offset-4 hover:underline"
                >
                  {r.proveedor_nombre}
                </Link>
                {r.comentario && <p className="mt-1 text-base">{r.comentario}</p>}
                {r.replica && (
                  <p className="mt-1 text-base text-muted-foreground">
                    Respuesta: {r.replica}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={ocupado}
                    onClick={() =>
                      llamar('ocultar_resena', { p_resena_id: r.id, p_oculta: false })
                    }
                  >
                    Volver a mostrar
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={ocupado}
                    onClick={() => {
                      if (!confirm('¿Borrarla? Esto no se puede deshacer.')) return
                      llamar('borrar_resena', { p_resena_id: r.id })
                    }}
                  >
                    Borrar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-heading text-2xl">
          Fichas suspendidas ({datos.suspendidos.length})
        </h2>
        {datos.suspendidos.length === 0 ? (
          <p className="mt-3 text-base text-muted-foreground">Ninguna.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {datos.suspendidos.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <span className="text-base">{p.nombre_visible}</span>
                <Button
                  variant="outline"
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

      <section>
        <h2 className="font-heading text-2xl">Referencias</h2>
        <p className="mt-1 text-base text-muted-foreground">
          {datos.referencias_pendientes === 0
            ? 'No hay referencias por comprobar.'
            : `${datos.referencias_pendientes} por comprobar.`}{' '}
          Las comprueba el equipo de la fundación desde su panel, llamando.
        </p>

        <Button
          variant="outline"
          className="mt-3"
          onClick={() => setVerBitacora((v) => !v)}
        >
          <Eye className="size-4" aria-hidden="true" />
          {verBitacora ? 'Ocultar' : 'Ver'} quién ha leído referencias
        </Button>

        {verBitacora && (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Últimas 50 lecturas. Dice quién, cuándo y con qué motivo — nunca
              qué vio. Sobrevive al borrado de la referencia.
            </p>
            {accesos.length === 0 ? (
              <p className="mt-2 text-base text-muted-foreground">
                Nadie ha leído ninguna todavía.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {accesos.map((a) => (
                  <li key={a.id} className="rounded-lg border border-border p-3 text-sm">
                    <p>
                      <span className="font-mono">{a.lector_ref.slice(0, 8)}</span> ·{' '}
                      {a.rol_lector} ·{' '}
                      {new Date(a.leida_at).toLocaleString('es-CO')}
                    </p>
                    <p className="mt-1 text-muted-foreground">{a.motivo}</p>
                    {!a.existe_todavia && (
                      <p className="mt-1 text-muted-foreground">
                        La referencia ya se borró; el rastro se queda.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}
