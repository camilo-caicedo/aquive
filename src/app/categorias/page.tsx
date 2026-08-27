import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Search } from 'lucide-react'

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

  if (categorias.length === 0) notFound()

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Categorías" volver="/inicio" />
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
                className={`block h-full overflow-hidden rounded-2xl bg-card ${SOMBRA_CARTEL[familia]} transition-transform hover:-translate-y-0.5`}
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

      <p className="mt-6 text-base text-muted-foreground">
        ¿Ya sabes a quién buscas?{' '}
        <Link href="/directorio" className="text-enlace underline underline-offset-4">
          <Search className="mr-1 inline size-4" aria-hidden="true" />
          Buscar en el directorio
        </Link>
      </p>
    </main>
  )
}
