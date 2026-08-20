import Link from 'next/link'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { createClient } from '@/lib/supabase/server'
import type { SolicitudAdmin } from '@/lib/types'
import { PanelSolicitudesAdmin } from '../panel-solicitudes-admin'

export const metadata = { title: 'Solicitudes vivas' }

type Filtro = 'abiertas' | 'sin-respuestas' | 'entregadas'

/**
 * La pantalla para cuando uno se entera por fuera de que algo ya se
 * resolvió.
 *
 * Los tres chips están en la URL y no en estado de cliente, como el resto
 * de los filtros de la app: el enlace se comparte igual y el servidor
 * arma la lista. «Sin respuestas» es justo el que hay que mirar — son las
 * solicitudes por las que todavía no se ha movido nadie.
 */
export default async function SolicitudesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>
}) {
  const { filtro: crudo } = await searchParams
  const filtro: Filtro =
    crudo === 'sin-respuestas' || crudo === 'entregadas' ? crudo : 'abiertas'

  const supabase = await createClient()
  // Por RPC y no por la vista pública: el panel tiene que seguir viendo
  // las que acaba de cerrar, y esas ya no salen en el tablero.
  const { data } = await supabase.rpc('solicitudes_admin')
  const todas = (data as unknown as SolicitudAdmin[]) ?? []

  const abiertas = todas.filter((s) => s.estado !== 'cumplida')
  const sinRespuestas = abiertas.filter((s) => s.respuestas === 0)
  const entregadas = todas.filter((s) => s.estado === 'cumplida')

  const listas: Record<Filtro, SolicitudAdmin[]> = {
    abiertas,
    'sin-respuestas': sinRespuestas,
    entregadas,
  }

  const CHIPS: { clave: Filtro; etiqueta: string; cuantas: number }[] = [
    { clave: 'abiertas', etiqueta: 'Abiertas', cuantas: abiertas.length },
    { clave: 'sin-respuestas', etiqueta: 'Sin respuestas', cuantas: sinRespuestas.length },
    { clave: 'entregadas', etiqueta: 'Entregadas', cuantas: entregadas.length },
  ]

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Solicitudes vivas" volver="/admin">
        <nav aria-label="Filtrar solicitudes" className="riel -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {CHIPS.map((c) => {
            const activo = filtro === c.clave
            return (
              <Link
                key={c.clave}
                href={
                  c.clave === 'abiertas'
                    ? '/admin/solicitudes'
                    : `/admin/solicitudes?filtro=${c.clave}`
                }
                aria-current={activo ? 'page' : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors ${
                  activo
                    ? 'border-border bg-card font-semibold text-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground hover:bg-muted'
                }`}
              >
                {c.etiqueta}
                <span
                  className={`rounded-full px-2 text-sm ${
                    activo ? 'bg-secondary text-secondary-foreground' : 'bg-muted'
                  }`}
                >
                  {c.cuantas}
                </span>
              </Link>
            )
          })}
        </nav>
      </CabeceraPantalla>

      <PanelSolicitudesAdmin solicitudes={listas[filtro]} />
    </main>
  )
}
