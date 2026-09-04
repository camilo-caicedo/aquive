import { Inbox } from 'lucide-react'
import type { Database } from '@/lib/types'
import { FichaEntidad } from './ficha-entidad'

type Entidad = Database['public']['Views']['entidades_publicas']['Row']

/**
 * Las fichas del directorio.
 *
 * El contenido de cada una vive en `FichaEntidad`, que es también lo que se
 * pinta en `/entidad/<id>`. Aquí queda lo que es de la lista: el vacío, el
 * ancla de cada fila y la traducción de códigos DANE a nombres.
 */
export function ListaEntidades({
  entidades,
  nombreMunicipio,
}: {
  entidades: Entidad[]
  nombreMunicipio: Map<string, string>
}) {
  if (entidades.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
        <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-base text-muted-foreground">
          Todavía no hay entidades en esta lista.
        </p>
      </div>
    )
  }

  return (
    <ul className="revelar mt-6 space-y-3">
      {entidades.map((e) => (
        <li
          key={e.id}
          id={`e-${e.id}`}
          className="animar-entrada rounded-2xl bg-card p-4 shadow-canto"
        >
          <FichaEntidad
            entidad={{
              id: e.id,
              nombre: e.nombre,
              subtitulo: e.subtitulo,
              cobertura: e.cobertura,
              descripcion: e.descripcion,
              pie: e.pie,
              // `enlaces` es `jsonb` y la base no garantiza su forma. Lo que
              // no tenga etiqueta y url de texto no llega a la pantalla: allí
              // ya no habría manera de distinguir un enlace roto de uno que
              // no se pintó.
              enlaces: e.enlaces.flatMap((enlace) =>
                typeof enlace?.etiqueta === 'string' && typeof enlace?.url === 'string'
                  ? [{ etiqueta: enlace.etiqueta, url: enlace.url }]
                  : [],
              ),
              municipios: e.municipios.map((c) => nombreMunicipio.get(c) ?? c),
            }}
          />
        </li>
      ))}
    </ul>
  )
}
