import Link from 'next/link'
import { Search } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { TarjetaCategoria } from '@/components/tarjeta-categoria'

export const metadata = { title: 'Categorías' }

/**
 * Pantalla 06. La puerta ancha al directorio, para quien no sabe qué buscar.
 *
 * Solo salen los grupos que tienen a alguien detrás. Una rejilla de doce
 * tarjetas donde la mitad dicen «0 cerca» no es un catálogo: es la lista de
 * lo que no tenemos, y desanima antes de la primera búsqueda.
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
      {/* Imagen grande + nombre corto: es lo que pidió el cliente,
          «especialmente importante para personas adultas o con menor
          familiaridad digital». La foto puede no estar todavía —
          `TarjetaCategoria` cae con gracia a la cinta de color mientras
          tanto—, así que ya no hace falta explicar qué significa el color. */}
      <ul className="mt-6 grid grid-cols-2 gap-3">
        {categorias.map((c) => (
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
