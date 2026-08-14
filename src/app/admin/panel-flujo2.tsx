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
 * Lo que el administrador necesita mirar del Flujo 2, y nada más.
 *
 * Dos cosas: los hilos que se quedaron sin fundación —el fallback de
 * §8-F5, que si no lo mira alguien deja a dos personas esperando— y la
 * bitácora de accesos a identidades, que es la evidencia de diligencia
 * frente a la fundación y frente a la SIC.
 *
 * La bitácora dice quién leyó, cuándo y por qué. NUNCA qué leyó: ahí no
 * hay ni un nombre ni un documento, y por eso puede vivir en una pantalla.
 */
export function PanelFlujoDos({ datos }: { datos: PanelFlujo2 }) {
  return (
    <div className="mt-3 space-y-4">
      <p className="text-base text-muted-foreground">
        {datos.hilos_abiertos}{' '}
        {datos.hilos_abiertos === 1 ? 'conversación abierta' : 'conversaciones abiertas'}
      </p>

      <div>
        <h3 className="text-lg font-bold">Hilos sin fundación</h3>
        {datos.sin_aliado.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-border p-4 text-center text-base text-muted-foreground">
            Ninguno. Es lo que debería pasar siempre.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {datos.sin_aliado.map((h) => (
              <li key={h.id} className="rounded-lg border border-primary/25 bg-accent p-3">
                <p className="font-mono text-base font-bold text-accent-foreground">
                  {h.codigo}
                </p>
                <p className="text-base text-accent-foreground">
                  {h.municipio} · desde el {fecha(h.creada_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          Pasa cuando una fundación se desactiva con hilos vivos. Hay dos
          personas esperando: o se reactiva la organización, o la solicitud
          vuelve al flujo directo.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold">Quién ha visto identidades</h3>
        {datos.accesos.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-border p-4 text-center text-base text-muted-foreground">
            Nadie ha consultado ninguna.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {datos.accesos.map((a, i) => (
              <li key={i} className="rounded-lg border border-border p-3 text-base">
                <p className="font-medium">
                  {a.rol === 'admin' ? 'Administración' : 'Fundación'}
                  {a.huerfano && ' · la identidad ya no existe'}
                </p>
                <p className="text-muted-foreground">{a.motivo}</p>
                <p className="text-sm text-muted-foreground">{fecha(a.cuando)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
