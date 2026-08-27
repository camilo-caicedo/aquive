import { ScrollText } from 'lucide-react'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Estado } from '@/components/estado'
import { createClient } from '@/lib/supabase/server'
import type { AccesoBitacora } from '@/lib/types'

export const metadata = { title: 'Bitácora' }

// ⚠ Antes había dos: identidades y referencias. Las identidades se fueron
// con el flujo acompañado (ADR 0007), así que ya no hay nada que filtrar —
// pero la bitácora se queda, porque `accesos_referencia` sigue vivo y ese
// rastro sobrevive al dato (mínimo legal 4).

const HOY = 'Hoy'

/** «Hoy», «Ayer», o el día escrito. Agrupa por fecha local, no por UTC. */
function dia(iso: string) {
  const d = new Date(iso)
  const hoy = new Date()
  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (mismoDia(d, hoy)) return HOY
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  if (mismoDia(d, ayer)) return 'Ayer'
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

/**
 * La bitácora de lecturas, unificada.
 *
 * Salía escondida detrás de un botón dentro de Servicios y ahora es una
 * fila del índice. Ese es el punto entero: es la evidencia de
 * diligencia frente a la fundación y frente a la SIC, y un registro de
 * accesos que nadie mira no disuade a nadie.
 *
 * ⚠ Dice quién leyó, cuándo y con qué motivo. Nunca qué leyó, y sobrevive
 * al borrado del dato que registra.
 */
export default async function BitacoraPage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('bitacora_accesos')
  const lista = (data as unknown as AccesoBitacora[] | null) ?? []

  // Agrupada por día, en el orden en que ya viene: la RPC ordena por fecha
  // descendente, así que basta con cortar cuando cambia el día.
  const grupos: { dia: string; filas: AccesoBitacora[] }[] = []
  for (const a of lista) {
    const d = dia(a.cuando)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.dia === d) ultimo.filas.push(a)
    else grupos.push({ dia: d, filas: [a] })
  }

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Bitácora" volver="/admin">
        <p className="mt-1 text-base text-muted-foreground">Últimas lecturas</p>
      </CabeceraPantalla>

      <p className="rounded-2xl bg-accent p-4 text-base leading-relaxed text-accent-foreground">
        Dice quién leyó, cuándo y con qué motivo. <strong>Nunca qué leyó</strong>,
        y sobrevive al borrado del dato que registra.
      </p>

      {lista.length === 0 ? (
        <div className="mt-4">
          <Estado
            Icono={ScrollText}
            titulo="Nadie ha leído nada todavía"
            detalle="Aparece aquí cada vez que alguien abre una referencia."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {grupos.map((g) => (
            <section key={g.dia}>
              <h2 className="font-heading text-xs tracking-[0.085em] uppercase text-muted-foreground">{g.dia}</h2>
              <ul className="mt-2 space-y-2">
                {g.filas.map((a, i) => (
                  <li key={`${a.lector}-${a.cuando}-${i}`} className="rounded-2xl bg-card p-3 shadow-canto">
                    <p className="text-base font-medium">
                      {a.organizacion ?? (a.rol === 'admin' ? 'Administración' : 'Una fundación')}{' '}
                      · {a.tipo}
                    </p>
                    <p className="mt-0.5 text-base">«{a.motivo}»</p>
                    <p className="mt-0.5 text-base text-muted-foreground">
                      <span className="font-mono">{a.lector}</span> · {a.rol} ·{' '}
                      {hora(a.cuando)}
                    </p>
                    {a.huerfano && (
                      <p className="mt-1 text-base text-muted-foreground">
                        La referencia ya se
                        borró; el rastro se queda.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-6 text-base text-muted-foreground">
        Si un motivo está vacío o no dice nada —«consulta», «revisión»—, eso es
        lo que hay que hablar con la organización. La bitácora no lo puede
        impedir; solo lo puede mostrar.
      </p>
    </main>
  )
}
