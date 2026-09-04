import Link from 'next/link'
import { Search, Briefcase, Heart } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { TarjetaCategoria } from '@/components/tarjeta-categoria'

/**
 * La portada de quien ya está dentro.
 *
 * ADR 0014, «la versión mínima»: el cliente probó la aplicación y pidió
 * literalmente «El inicio debe ser extremadamente sencillo». Se van la tira
 * «Disponibles ahora», productos, profesionales y entidades — cualquier cosa
 * que compitiera con las tres acciones de arriba. Lo que queda:
 *
 * 1. Tres acciones de igual rango — busco, ofrezco, dono — ninguna en lima
 *    (regla de interfaz 2 no aplica igual con tres acciones del mismo peso;
 *    se resuelve como en `bienvenida.tsx`: tarjetas blancas, cada una con su
 *    sombra de color, sin que ninguna reclame el relleno de la acción
 *    principal).
 * 2. Las categorías con más gente, con foto, para que buscar un servicio
 *    quede a un clic de aquí y no a dos.
 */
export async function Inicio({ municipio }: { municipio?: string }) {
  const categorias = await servidor.servicios.categorias({ municipio })
  const destacadas = categorias.slice(0, 6)

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-5">
      <nav aria-label="Qué quieres hacer" className="flex flex-col gap-3">
        <Link
          href="/categorias"
          className="pulsable-tarjeta shadow-cartel-azul flex items-center gap-4 rounded-2xl bg-card p-4 transition-transform hover:-translate-y-0.5"
        >
          <Search className="size-6 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-heading block text-xl">Busco</span>
            <span className="mt-0.5 block text-base text-muted-foreground">
              Necesito un producto o servicio
            </span>
          </span>
        </Link>

        <Link
          href="/servicios/soy-proveedor"
          className="pulsable-tarjeta shadow-cartel-amarillo flex items-center gap-4 rounded-2xl bg-card p-4 transition-transform hover:-translate-y-0.5"
        >
          <Briefcase className="size-6 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-heading block text-xl">Ofrezco</span>
            <span className="mt-0.5 block text-base text-muted-foreground">
              Quiero ofrecer un producto o servicio
            </span>
          </span>
        </Link>

        <Link
          href="/donaciones"
          className="pulsable-tarjeta shadow-cartel-rojo flex items-center gap-4 rounded-2xl bg-card p-4 transition-transform hover:-translate-y-0.5"
        >
          <Heart className="size-6 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-heading block text-xl">Dono</span>
            <span className="mt-0.5 block text-base text-muted-foreground">
              Quiero donar
            </span>
          </span>
        </Link>
      </nav>

      {destacadas.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-2xl">Categorías</h2>
          <ul className="mt-3 grid grid-cols-3 gap-2.5">
            {destacadas.map((c) => (
              <li key={c.grupo}>
                <TarjetaCategoria
                  grupo={c.grupo}
                  nombre={c.nombre}
                  cuantos={c.cuantos}
                  href={
                    municipio
                      ? `/?municipio=${municipio}&grupo=${c.grupo}`
                      : `/?grupo=${c.grupo}`
                  }
                />
              </li>
            ))}
          </ul>
          <Link
            href="/categorias"
            className="pulsable shadow-canto mt-3 flex min-h-12 items-center justify-center rounded-full bg-card px-4 text-base font-semibold text-foreground"
          >
            Ver todas las categorías
          </Link>
        </section>
      )}
    </main>
  )
}
