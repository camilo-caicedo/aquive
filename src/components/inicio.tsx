import Link from 'next/link'
import { Heart, ShoppingBag, Wrench } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { GRUPOS, precioLegible, zonaLegible } from '@/lib/servicios'
import { CINTA, SOMBRA_CARTEL, TINTA_CINTA, familiaDe } from '@/lib/familias'
import { TiraEntidades, TiraProfesionales } from '@/components/inicio-tiras'
import type { GrupoOficio } from '@/lib/types'

/**
 * La portada de quien ya está dentro.
 *
 * No es el directorio: es la puerta a los tres módulos —servicios, productos y
 * donaciones—, más una tira de quién está trabajando ahora mismo. El listado
 * completo y filtrable vive en `/directorio`, que es adonde lleva «Ver todo».
 *
 * ⚠ Sin distancia en kilómetros, aunque el diseño la dibuje. Para decir «1,2
 * km» habría que saber dónde está quien mira, y ese es justo el dato que esta
 * aplicación no le pide a quien busca. Se dice la zona y el municipio, que es
 * la granularidad de todo el sitio.
 */
export async function Inicio({ municipio }: { municipio?: string }) {
  const { disponibles, profesionales, entidades } =
    await servidor.servicios.inicio({ municipio })

  return (
    <main className="mx-auto max-w-2xl px-4 py-5">
      {/* Los tres módulos, de entrada y sin preámbulo. Antes había un título
          «Hoy en tu barrio» encima: una línea que no dice nada que no diga ya
          la fila de abajo, y que empujaba el contenido fuera del primer
          pantallazo (regla de interfaz 1). */}
      <nav aria-label="Qué buscas">
        <ul className="grid grid-cols-3 gap-3">
          <li>
            <Link
              href="/categorias"
              className="bg-familia-azul shadow-cartel-azul flex h-28 flex-col justify-between rounded-2xl p-3 text-white transition-transform hover:-translate-y-0.5"
            >
              <Wrench className="size-6" aria-hidden="true" />
              <span className="font-heading text-base">Servicio</span>
            </Link>
          </li>
          <li>
            <Link
              href="/barrio"
              className="bg-familia-amarillo shadow-cartel-amarillo text-foreground flex h-28 flex-col justify-between rounded-2xl p-3 transition-transform hover:-translate-y-0.5"
            >
              <ShoppingBag className="size-6" aria-hidden="true" />
              <span className="font-heading text-base">Producto</span>
            </Link>
          </li>
          <li>
            <Link
              href="/muro"
              className="bg-familia-rojo shadow-cartel-rojo text-foreground flex h-28 flex-col justify-between rounded-2xl p-3 transition-transform hover:-translate-y-0.5"
            >
              <Heart className="size-6" aria-hidden="true" />
              <span className="font-heading text-base">Donar</span>
            </Link>
          </li>
        </ul>
      </nav>

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-2xl">Disponibles ahora</h2>
          <Link
            href="/directorio"
            className="text-enlace shrink-0 text-base underline underline-offset-4"
          >
            Ver todo
          </Link>
        </div>

        {disponibles.length === 0 ? (
          <p className="mt-3 text-base text-muted-foreground">
            Nadie tiene marcada esta franja horaria ahora mismo.{' '}
            <Link
              href="/directorio"
              className="text-enlace underline underline-offset-4"
            >
              Mira el directorio completo
            </Link>
            .
          </p>
        ) : (
          <ul className="riel -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
            {disponibles.map((p) => {
              const grupo = p.oficios[0]?.grupo ?? null
              const familia = familiaDe(grupo)
              const oficio = p.oficios[0]
              return (
                <li key={p.id} className="w-64 shrink-0">
                  <Link
                    href={`/prestador/${p.id}`}
                    className={`block h-full overflow-hidden rounded-2xl bg-card ${SOMBRA_CARTEL[familia]}`}
                  >
                    <div
                      className={`flex items-center justify-between gap-2 px-3 py-1.5 ${CINTA[familia]} ${TINTA_CINTA[familia]}`}
                    >
                      <span className="font-heading truncate text-xs tracking-[0.085em] uppercase">
                        {grupo
                          ? (GRUPOS[grupo as GrupoOficio] ?? 'Oficios')
                          : 'Oficios'}
                      </span>
                      {/* «Hoy» es literal: esta tira solo trae a quien declaró
                          este día y esta franja. */}
                      <span className="shadow-canto shrink-0 rounded-full bg-card px-2 py-0.5 text-xs font-bold">
                        HOY
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="font-heading truncate text-lg">
                        {p.nombre_visible}
                      </p>
                      {oficio && (
                        <p className="mt-0.5 truncate text-base text-muted-foreground">
                          {oficio.nombre}
                        </p>
                      )}
                      {oficio && (
                        <p className="mt-2 text-base font-semibold">
                          {precioLegible(
                            oficio.modo,
                            oficio.precio_desde,
                            oficio.unidad,
                          )}
                        </p>
                      )}
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {[
                          zonaLegible(p.zona_nombre, p.zona_texto),
                          p.municipio_nombre,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="shadow-cartel-rojo mt-8 rounded-2xl bg-card p-5">
        <h2 className="font-heading text-2xl leading-tight">
          ¿Tienes algo que ya no usas?
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          El muro de donación es del barrio: publicas, alguien lo pide y se
          acuerdan por chat.
        </p>
        <Link
          href="/muro/publicar?cara=ofrece"
          className="bg-primary text-primary-foreground shadow-boton active:shadow-boton-hundido mt-4 inline-flex min-h-14 items-center rounded-full px-6 text-base font-semibold transition-all active:translate-x-[2px] active:translate-y-[2px]"
        >
          Abrir el muro
        </Link>
      </section>

      <TiraProfesionales profesionales={profesionales} />

      <TiraEntidades entidades={entidades} />
    </main>
  )
}
