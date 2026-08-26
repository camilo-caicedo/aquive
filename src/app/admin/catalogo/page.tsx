import { Lightbulb } from 'lucide-react'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Pestanas } from '@/components/pestanas'
import { Estado } from '@/components/estado'
import { createClient } from '@/lib/supabase/server'
import { categoria } from '@/lib/catalogo'
import type { OrigenSugerencia, SugerenciaPendiente } from '@/lib/types'
import { AccionesSugerencia } from '../acciones-sugerencia'

export const metadata = { title: 'Catálogo' }

const ORIGENES: Record<OrigenSugerencia, string> = {
  solicitante: 'la propuso quien pidió ayuda',
  ofertador: 'la propuso quien ofreció ayuda',
  aliado: 'la propuso un aliado',
}

function fecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Vista = 'sugeridos' | 'items' | 'oficios'

/**
 * El catálogo: la cola de sugerencias, y las dos listas de solo lectura.
 *
 * Ítems y Oficios existen para poder mirar qué hay sin abrir la base de
 * datos — que era lo único que se podía hacer hasta ahora, y por eso nadie
 * lo miraba.
 */
export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>
}) {
  const { ver } = await searchParams
  const vista: Vista = ver === 'items' || ver === 'oficios' ? ver : 'sugeridos'

  const supabase = await createClient()
  const [{ data: sugerenciasData }, { data: items }, { data: oficios }] = await Promise.all([
    supabase.rpc('sugerencias_pendientes'),
    vista === 'items'
      ? supabase.from('catalogo_items').select('id, nombre, categoria, unidad, activo').order('orden')
      : Promise.resolve({ data: null }),
    vista === 'oficios'
      ? supabase.from('catalogo_oficios').select('id, nombre, grupo, riesgo, activo').order('orden')
      : Promise.resolve({ data: null }),
  ])

  const sugerencias = (sugerenciasData as unknown as SugerenciaPendiente[]) ?? []

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Catálogo" volver="/admin">
        <div className="mt-3">
          <Pestanas
            etiqueta="Qué parte del catálogo ver"
            pestanas={[
              {
                href: '/admin/catalogo',
                etiqueta: 'Sugeridos',
                activa: vista === 'sugeridos',
                cuenta: sugerencias.length,
              },
              {
                href: '/admin/catalogo?ver=items',
                etiqueta: 'Ítems',
                activa: vista === 'items',
              },
              {
                href: '/admin/catalogo?ver=oficios',
                etiqueta: 'Oficios',
                activa: vista === 'oficios',
              },
            ]}
          />
        </div>
      </CabeceraPantalla>

      {vista === 'sugeridos' && (
        <>
          <p className="rounded-2xl bg-secondary p-3 text-sm text-secondary-foreground">
            Aprobar crea un ítem nuevo. Fusionar reutiliza uno existente y todo
            lo que usaba la sugerencia pasa a apuntar ahí. Rechazar no crea ni
            cambia nada.
          </p>

          {sugerencias.length === 0 ? (
            <div className="mt-4">
              <Estado
                Icono={Lightbulb}
                titulo="No hay ítems sugeridos"
                detalle="Aparecen aquí cuando alguien propone algo que no está en el catálogo."
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {sugerencias.map((s) => (
                <li key={s.id} className="rounded-2xl bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-base font-bold">{s.nombre_propuesto}</span>
                    <span className="text-sm text-muted-foreground">{fecha(s.creada_at)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {s.categoria_sugerida
                      ? categoria(s.categoria_sugerida).etiqueta
                      : 'Sin categoría sugerida'}{' '}
                    · {ORIGENES[s.origen]} · en uso en {s.usos}{' '}
                    {s.usos === 1 ? 'solicitud' : 'solicitudes'}
                  </p>
                  <AccionesSugerencia sugerencia={s} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {vista === 'items' && (
        <ul className="space-y-2">
          {(items ?? []).map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-3 shadow-sm"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{i.nombre}</span>
                <span className="block text-sm text-muted-foreground">
                  {categoria(i.categoria).etiqueta} · {i.unidad} ·{' '}
                  <span className="font-mono">{i.id}</span>
                </span>
              </span>
              {!i.activo && (
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-sm text-muted-foreground">
                  Inactivo
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {vista === 'oficios' && (
        <ul className="space-y-2">
          {(oficios ?? []).map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-3 shadow-sm"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{o.nombre}</span>
                <span className="block text-sm text-muted-foreground">
                  {o.grupo} · <span className="font-mono">{o.id}</span>
                </span>
              </span>
              {/* La regla S en una etiqueta: un oficio de riesgo alto no se
                  publica sin teléfono verificado y una referencia. */}
              {o.riesgo === 'alto' && (
                <span className="shrink-0 rounded-full border border-enlace/25 bg-accent px-2.5 py-0.5 text-sm font-medium text-accent-foreground">
                  Riesgo alto
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
