import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { CINTA, TINTA_CINTA, type Familia } from '@/lib/familias'

export const metadata = { title: 'Dónde hay gente' }

/**
 * Pantalla 08. Dónde hay gente trabajando, por zona.
 *
 * ⚠ NO es un mapa, y la diferencia no es de presentación.
 *
 * El prototipo dibuja globos posicionados sobre una base ilustrada de Cali.
 * Aquí no se hace, y a propósito: en la base no hay coordenadas de zona, así
 * que cualquier posición sería inventada. Un globo puesto a ojo dice que
 * Belén queda al noroeste de Laureles, y eso o es verdad por casualidad o es
 * una mentira sobre geografía real, que es peor que no dibujar nada.
 *
 * Lo que sí se conserva del diseño es lo que importa: el tamaño del globo
 * dice cuánta gente hay, la palabra dice qué zona es, y el pie explica que
 * una zona no es una persona. La regla de producto 10 fija la granularidad
 * en barrio o comuna, y esto es exactamente eso.
 *
 * Si algún día entran coordenadas de zona en la base, esto se vuelve un mapa
 * de verdad y necesita su propio ADR: publicar dónde trabaja alguien que
 * trabaja solo en la calle no es un detalle de interfaz.
 */
export default async function ZonasPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string }>
}) {
  const { municipio } = await searchParams
  const zonas = await servidor.servicios.zonas({ municipio })

  if (zonas.length === 0) notFound()

  const total = zonas.reduce((suma, z) => suma + z.cuantos, 0)
  const mayor = Math.max(...zonas.map((z) => z.cuantos))

  // Los cuatro colores rotan para que la pantalla no sea una mancha de un
  // solo tono. Aquí el color NO informa —una zona no pertenece a ninguna
  // familia de oficio— y por eso puede rotar: el nombre y el número, que son
  // los que dicen algo, están siempre escritos.
  const COLORES: Familia[] = ['azul', 'amarillo', 'verde', 'rojo']

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Dónde hay gente" volver="/" />
      <p className="text-base text-muted-foreground">
        {total} {total === 1 ? 'persona' : 'personas'} en {zonas.length}{' '}
        {zonas.length === 1 ? 'zona' : 'zonas'}
        {zonas[0].municipio_nombre ? ` de ${zonas[0].municipio_nombre}` : ''}.
      </p>

      {/* Los globos, ordenados por cuánta gente hay y no por posición
          geográfica, que no tenemos. El área crece con el conteo; el mínimo
          son 48 px porque es un objetivo táctil. */}
      <ul className="mt-6 flex flex-wrap items-end gap-3">
        {zonas.map((z, i) => {
          const familia = COLORES[i % COLORES.length]
          const lado = 48 + Math.round((z.cuantos / mayor) * 40)
          return (
            <li key={z.id}>
              <Link
                href={`/?zona=${z.id}&municipio=${z.municipio}`}
                className={`flex flex-col items-center justify-center rounded-full ${CINTA[familia]} ${TINTA_CINTA[familia]} transition-transform hover:-translate-y-0.5`}
                style={{ width: lado, height: lado }}
                aria-label={`${z.nombre}: ${z.cuantos} ${z.cuantos === 1 ? 'persona' : 'personas'}`}
              >
                {/* El número dentro del globo y el nombre debajo: el número
                    solo no dice de qué zona es, y el color no lo aclara. */}
                <span className="font-heading text-lg leading-none font-extrabold">
                  {z.cuantos}
                </span>
              </Link>
              <p className="mt-1 max-w-24 text-center text-sm leading-tight">{z.nombre}</p>
            </li>
          )
        })}
      </ul>

      <p className="mt-6 flex items-start gap-2 text-base text-muted-foreground">
        <MapPin className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
        <span>
          Cada globo es una <strong className="font-semibold">zona</strong>, no una
          persona: dice cuánta gente trabaja ahí. Nadie publica su dirección y
          AquíVe no la guarda.
        </span>
      </p>

      <p className="mt-4">
        <Link
          href={municipio ? `/mapa?municipio=${municipio}` : '/mapa'}
          className="text-enlace text-base underline underline-offset-4"
        >
          Ver el mapa con quienes publicaron su ubicación
        </Link>
      </p>

      <ul className="mt-6 space-y-2">
        {zonas.map((z) => (
          <li key={z.id}>
            <Link
              href={`/?zona=${z.id}&municipio=${z.municipio}`}
              className="shadow-canto flex min-h-14 items-center justify-between gap-3 rounded-xl bg-card px-4"
            >
              <span className="text-base font-medium">{z.nombre}</span>
              <span className="text-base text-muted-foreground">
                {z.cuantos} {z.cuantos === 1 ? 'persona' : 'personas'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
