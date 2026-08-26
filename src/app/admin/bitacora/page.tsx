import Link from 'next/link'
import { ScrollText } from 'lucide-react'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Estado } from '@/components/estado'
import { createClient } from '@/lib/supabase/server'
import type { AccesoBitacora } from '@/lib/types'

export const metadata = { title: 'Bitácora' }

type Filtro = 'todo' | 'identidades' | 'referencias'

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
 * Salía escondida detrás de un botón en dos pantallas distintas —las
 * identidades dentro de Aliados, las referencias dentro de Servicios— y
 * ahora es una fila del índice. Ese es el punto entero: es la evidencia de
 * diligencia frente a la fundación y frente a la SIC, y un registro de
 * accesos que nadie mira no disuade a nadie.
 *
 * ⚠ Dice quién leyó, cuándo y con qué motivo. Nunca qué leyó, y sobrevive
 * al borrado del dato que registra.
 */
export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>
}) {
  const { tipo: crudo } = await searchParams
  const filtro: Filtro =
    crudo === 'identidades' || crudo === 'referencias' ? crudo : 'todo'

  const supabase = await createClient()
  const { data } = await supabase.rpc('bitacora_accesos')
  const todas = (data as unknown as AccesoBitacora[] | null) ?? []

  const lista =
    filtro === 'todo'
      ? todas
      : todas.filter((a) =>
          filtro === 'identidades' ? a.tipo === 'identidad' : a.tipo === 'referencia'
        )

  // Agrupada por día, en el orden en que ya viene: la RPC ordena por fecha
  // descendente, así que basta con cortar cuando cambia el día.
  const grupos: { dia: string; filas: AccesoBitacora[] }[] = []
  for (const a of lista) {
    const d = dia(a.cuando)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.dia === d) ultimo.filas.push(a)
    else grupos.push({ dia: d, filas: [a] })
  }

  const CHIPS: { clave: Filtro; etiqueta: string }[] = [
    { clave: 'todo', etiqueta: 'Todo' },
    { clave: 'identidades', etiqueta: 'Identidades' },
    { clave: 'referencias', etiqueta: 'Referencias' },
  ]

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Bitácora" volver="/admin">
        <p className="mt-1 text-base text-muted-foreground">Últimas lecturas</p>
        <nav aria-label="Filtrar la bitácora" className="riel -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {CHIPS.map((c) => {
            const activo = filtro === c.clave
            return (
              <Link
                key={c.clave}
                href={c.clave === 'todo' ? '/admin/bitacora' : `/admin/bitacora?tipo=${c.clave}`}
                aria-current={activo ? 'page' : undefined}
                className={`inline-flex min-h-12 shrink-0 items-center rounded-full border px-4 text-base transition-colors ${
                  activo
                    ? 'border-border bg-card font-semibold text-foreground shadow-canto'
                    : 'border-transparent text-muted-foreground hover:bg-muted'
                }`}
              >
                {c.etiqueta}
              </Link>
            )
          })}
        </nav>
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
            detalle="Aparece aquí cada vez que alguien abre una identidad o una referencia."
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
                        {a.tipo === 'identidad' ? 'La identidad' : 'La referencia'} ya se
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
