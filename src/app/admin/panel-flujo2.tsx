import type { PanelFlujo2 } from '@/lib/types'

function fecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Los hilos que se quedaron sin fundación.
 *
 * Es el fallback de §8-F5: pasa cuando una fundación se desactiva con
 * hilos vivos, y si no lo mira alguien deja a dos personas esperando. Por
 * eso va primero de la pantalla y en terracota tenue, y por eso lleva la
 * consecuencia escrita: es lo único urgente de aquí.
 *
 * La bitácora de identidades se fue a `/admin/bitacora`, unificada con la
 * de referencias: estaba escondida detrás de un botón en dos pestañas
 * distintas, y un registro de accesos que nadie mira no disuade a nadie.
 */
export function PanelFlujoDos({ datos }: { datos: PanelFlujo2 }) {
  return (
    <section>
      <h2 className="font-heading text-2xl">Acompañamiento</h2>
      <p className="mt-1 text-base text-muted-foreground">
        {datos.hilos_abiertos}{' '}
        {datos.hilos_abiertos === 1 ? 'conversación abierta' : 'conversaciones abiertas'}
      </p>

      {datos.sin_aliado.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border p-4 text-center text-base text-muted-foreground">
          Ningún hilo sin fundación. Es lo que debería pasar siempre.
        </p>
      ) : (
        <>
          {/* Tarjeta de cartel en rojo pastel, el mismo gajo que le toca a
              esta cola en el índice: si un hilo se queda sin fundación hay
              dos personas esperando, y eso tiene que reconocerse a media
              pantalla. El color no informa solo — debajo va escrito qué
              pasó y qué se puede hacer. */}
          <ul className="mt-3 space-y-3.5">
            {datos.sin_aliado.map((h) => (
              <li key={h.id} className="rounded-2xl bg-card p-4 shadow-cartel-rojo">
                <p className="font-heading text-xs tracking-[0.085em] uppercase text-muted-foreground">
                  Sin fundación
                </p>
                <p className="mt-1 font-mono text-lg font-bold">{h.codigo}</p>
                <p className="mt-0.5 text-base">
                  {h.municipio} · desde el {fecha(h.creada_at)}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-base text-muted-foreground">
            Pasa cuando una fundación se desactiva con hilos vivos. Hay dos
            personas esperando: o se reactiva la organización, o la solicitud
            vuelve al flujo directo.
          </p>
        </>
      )}
    </section>
  )
}
