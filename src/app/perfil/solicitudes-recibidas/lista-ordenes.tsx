import Link from 'next/link'

import { NOMBRE_GRUPO, type OrdenProveedor } from '@/contrato/servicios'
import { SelloEstadoSolicitud } from '@/components/sello-estado-solicitud'

/**
 * El índice de órdenes del prestador (ADR 0015): qué, cuándo, estado y una
 * acción — la fila entera, que lleva a su chat.
 *
 * ⚠ Ya no lleva los botones de aceptar/rechazar/cerrar: el sitio donde se
 * acuerda y donde se cambia el estado es la conversación —con la tarjeta
 * fija arriba—, no esta lista compitiendo con ella (regla de interfaz 3).
 *
 * Sin «dónde» ni «quién»: la orden ya nació dirigida a esta ficha, así que
 * el municipio no dice nada nuevo, y el mínimo legal no cambia con el ADR
 * 0015 — la cuenta de quien pide sigue sin publicarse.
 */
export function ListaOrdenes({ ordenes }: { ordenes: OrdenProveedor[] }) {
  if (ordenes.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
        Todavía no te ha llegado ninguna solicitud.
      </p>
    )
  }

  return (
    <ul className="mt-4 space-y-3">
      {ordenes.map((o) => (
        <li key={o.id}>
          <Link
            href={`/chat/solicitud/${o.id}`}
            className="shadow-canto block rounded-2xl bg-card p-4 transition-transform active:scale-[0.99]"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-heading text-lg leading-tight">
                {o.subcategoria ?? o.detalle}
              </h2>
              <SelloEstadoSolicitud estado={o.estado} />
            </div>

            {o.subcategoria_en_revision && (
              <p className="font-heading mt-1 inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs tracking-[0.085em] text-accent-foreground uppercase">
                Todavía en revisión
              </p>
            )}

            <p className="mt-1 text-sm text-muted-foreground">
              {NOMBRE_GRUPO[o.grupo] ?? o.grupo} ·{' '}
              {new Date(o.creada_at).toLocaleDateString('es-CO')}
            </p>

            {o.subcategoria && o.detalle && <p className="mt-1 text-base">{o.detalle}</p>}
            {o.nota && <p className="mt-1 text-base text-muted-foreground">{o.nota}</p>}

            <p className="mt-1 font-mono text-sm text-muted-foreground">{o.codigo}</p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
