import Link from 'next/link'
import { ChevronRight, HandHelping, Search } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { CINTA, SOMBRA_CARTEL, TINTA_CINTA, familiaDe } from '@/lib/familias'

export const metadata = { title: 'Categorías' }

/**
 * Pantalla 06. La puerta ancha al directorio, para quien no sabe qué buscar.
 *
 * Solo salen los grupos que tienen a alguien detrás. Una rejilla de ocho
 * tarjetas donde cinco dicen «0 cerca» no es un catálogo: es la lista de lo
 * que no tenemos, y desanima antes de la primera búsqueda.
 *
 * El municipio viaja en la URL, así que «categorías en Cali» se puede pegar
 * en un grupo de WhatsApp igual que un filtro del directorio.
 */
export default async function CategoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string }>
}) {
  const { municipio } = await searchParams
  const categorias = await servidor.servicios.categorias({ municipio })

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Categorías" volver="/inicio" />

      {/* ⚠ Aquí había un `notFound()` cuando no hay ninguna categoría con
          gente detrás. Esta pantalla es la celda «Buscar» de la barra: un
          destino fijo de navegación que devuelve «esta página no existe» —
          y basta un municipio sin fichas en la URL para provocarlo. Una
          lista vacía se dice, no se convierte en un error. */}
      {categorias.length === 0 ? (
        <div className="shadow-canto rounded-2xl bg-card p-6">
          <p className="text-base">
            Todavía no hay nadie publicado
            {municipio ? ' en ese municipio' : ''}.
          </p>
          <p className="mt-2 text-base text-muted-foreground">
            Si vives de tu trabajo, tu ficha puede ser la primera: la ve
            cualquiera que busque cerca.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/servicios/soy-proveedor"
              className="text-enlace text-base underline underline-offset-4"
            >
              Publicar mi ficha
            </Link>
            {municipio && (
              <Link
                href="/categorias"
                className="text-enlace text-base underline underline-offset-4"
              >
                Ver todos los municipios
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
      <p className="text-base text-muted-foreground">
        Cada color es un lado de la sombrilla.
      </p>

      {/* Dos por línea también en el teléfono, y por eso la cinta apila el
          nombre y el conteo en vez de ponerlos lado a lado: a 320 px de
          ancho la tarjeta mide unos 140, y «Confección y arreglos · 1
          persona» en una sola línea se parte por donde caiga.

          Sin `line-clamp`: la tarjeta crece hasta que quepan sus oficios.
          Las dos de una fila se igualan solas por el `h-full`, así que una
          categoría con tres oficios no deja hueco al lado. */}
      <ul className="mt-6 grid grid-cols-2 gap-3">
        {categorias.map((c) => {
          const familia = familiaDe(c.grupo)
          const href = municipio
            ? `/?municipio=${municipio}&grupo=${c.grupo}`
            : `/?grupo=${c.grupo}`
          return (
            <li key={c.grupo}>
              <Link
                href={href}
                className={`pulsable-tarjeta block h-full overflow-hidden rounded-2xl bg-card ${SOMBRA_CARTEL[familia]} transition-transform hover:-translate-y-0.5`}
              >
                <div className={`px-3 py-2 ${CINTA[familia]} ${TINTA_CINTA[familia]}`}>
                  <p className="font-heading text-base leading-tight font-extrabold text-balance">
                    {c.nombre}
                  </p>
                  {/* El número va con la palabra al lado, nunca solo: «6» sin
                      «cerca» no dice si son personas, oficios o kilómetros. */}
                  <p className="text-sm font-semibold">
                    {c.cuantos} {c.cuantos === 1 ? 'persona' : 'personas'}
                  </p>
                </div>
                <p className="px-3 py-3 text-base text-muted-foreground">
                  {c.ejemplos.join(', ')}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* El otro lado de la pantalla. Las tarjetas de arriba son quién
          puede hacerte algo; esto es quién necesita que se lo hagan, y es
          por donde entra un prestador a buscar trabajo. Va debajo de las
          categorías, no entre ellas: son dos preguntas distintas. */}
      <Link
        href="/solicitudes"
        className="pulsable-tarjeta shadow-canto mt-6 flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-3 transition-colors hover:bg-muted"
      >
        <span className="bg-familia-verde flex size-10 shrink-0 items-center justify-center rounded-full text-foreground">
          <HandHelping className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-medium">Quién está pidiendo</span>
          <span className="block text-base text-muted-foreground">
            Si tienes cómo hacerlo, escríbele
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      <p className="mt-6 text-base text-muted-foreground">
        ¿Ya sabes a quién buscas?{' '}
        <Link href="/directorio" className="text-enlace underline underline-offset-4">
          <Search className="mr-1 inline size-4" aria-hidden="true" />
          Buscar en el directorio
        </Link>
      </p>
        </>
      )}
    </main>
  )
}
