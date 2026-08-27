import Link from 'next/link'
import Image from 'next/image'

import { precioDeProducto } from '@/lib/servicios'
import type { Producto } from '@/contrato/comunidad'

import type { EntidadBreve, ProfesionalBreve } from '@/contrato/servicios'

/**
 * Las dos tiras del final de la portada.
 *
 * Van SEPARADAS y no en una sola lista mezclada, aunque las dos sean tarjetas
 * blancas con scroll horizontal. No es simetría: son dos cosas que se buscan
 * por razones distintas.
 *
 * Un profesional es una persona con matrícula a la que contratas. Una entidad
 * es una organización a la que acudes, que no cobra y que no recibe pedidos
 * por aquí — la plataforma solo dice que existe y enlaza a su sitio. Metidas
 * en la misma fila, la segunda parece un prestador más y alguien intenta
 * contratarla.
 *
 * Sustituyen a «Lo que dice la gente». Las reseñas sueltas de la portada eran
 * elogios sin nada que hacer con ellos; esto lleva a dos directorios que
 * existen y que casi nadie encuentra.
 */
export function TiraProfesionales({
  profesionales,
}: {
  profesionales: ProfesionalBreve[]
}) {
  if (profesionales.length === 0) return null

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-2xl">Profesionales</h2>
        <Link
          href="/profesionales"
          className="text-enlace shrink-0 text-base underline underline-offset-4"
        >
          Ver todos
        </Link>
      </div>
      <p className="mt-1 text-base text-muted-foreground">
        Cada quien declara su matrícula. A algunos ya les revisamos que ese
        número exista en el registro.
      </p>

      <ul className="riel -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
        {profesionales.map((p) => (
          <li key={p.id} className="w-56 shrink-0">
            {/* A SU fila, no al principio del directorio. Esta tarjeta y el
                «Ver todos» de arriba llevaban al mismo sitio, así que tocar
                a alguien en concreto obligaba a volver a buscarlo en la
                lista. Ninguna de las dos listas tiene pantalla por fila —la
                fila ya trae teléfono, enlaces y servicios—, así que el
                destino es la fila dentro de su lista. */}
            <Link
              href={`/profesionales#p-${p.id}`}
              className="pulsable-tarjeta shadow-cartel-azul block h-full rounded-2xl bg-card p-4"
            >
              <p className="font-heading truncate text-base">{p.nombre_visible}</p>
              {p.profesion && (
                <p className="mt-0.5 truncate text-base text-muted-foreground">
                  {p.profesion}
                </p>
              )}
              {/* El sello no va solo: lleva la palabra. El color no puede ser
                  lo único que diga que algo está comprobado, y «revisada» no
                  significa «confiable» — lo aclara la ficha. */}
              <p className="mt-2">
                {p.verificado ? (
                  <span className="bg-ok-suave text-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium">
                    Matrícula revisada
                  </span>
                ) : (
                  <span className="bg-accent text-accent-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium">
                    Sin revisar
                  </span>
                )}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TiraEntidades({ entidades }: { entidades: EntidadBreve[] }) {
  if (entidades.length === 0) return null

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-2xl">Entidades</h2>
        <Link
          href="/entidades"
          className="text-enlace shrink-0 text-base underline underline-offset-4"
        >
          Ver todas
        </Link>
      </div>
      {/* Lo que son y lo que NO son, dicho arriba. Aparecer en esta lista no
          es un aval: la plataforma dice que existen y enlaza a su sitio, y no
          coordina nada con ellas por aquí. */}
      <p className="mt-1 text-base text-muted-foreground">
        Organizaciones que trabajan en la zona. No reciben pedidos por AquíVe:
        aquí solo decimos que existen y a dónde escribirles.
      </p>

      <ul className="riel -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
        {entidades.map((e) => (
          <li key={e.id} className="w-56 shrink-0">
            <Link
              href={`/entidades#e-${e.id}`}
              className="pulsable-tarjeta shadow-cartel-verde block h-full rounded-2xl bg-card p-4"
            >
              <p className="font-heading truncate text-base">{e.nombre}</p>
              {e.subtitulo && (
                <p className="mt-0.5 line-clamp-2 text-base text-muted-foreground">
                  {e.subtitulo}
                </p>
              )}
              <p className="mt-2">
                <span className="bg-secondary text-secondary-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium">
                  {e.cobertura === 'nacional' ? 'Nacional' : 'Local'}
                </span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Lo que se vende en el barrio, de lo más nuevo a lo más viejo.
 *
 * Va antes que profesionales y entidades a propósito: es lo que cambia
 * todos los días. Un profesional publicado hace tres meses sigue ahí; unos
 * tamales, no. Lo que se renueva va arriba, o la portada se queda quieta.
 *
 * Cada tarjeta lleva el precio, porque es lo primero que se mira, y no
 * lleva contacto: para eso está la lista, donde hay sitio para el botón sin
 * apretar la tarjeta a 224 px.
 */
export function TiraProductos({ productos }: { productos: Producto[] }) {
  if (productos.length === 0) return null

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-2xl">Hecho en el barrio</h2>
        <Link
          href="/barrio"
          className="text-enlace shrink-0 text-base underline underline-offset-4"
        >
          Ver todo
        </Link>
      </div>
      <p className="mt-1 text-base text-muted-foreground">
        Lo que hacen y venden las personas del directorio. Lo más nuevo primero.
      </p>

      <ul className="riel -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
        {productos.map((p) => (
          <li key={p.id} className="w-56 shrink-0">
            <Link
              href={`/barrio#prod-${p.id}`}
              className="pulsable-tarjeta shadow-cartel-amarillo block h-full overflow-hidden rounded-2xl bg-card"
            >
              {p.imagen ? (
                <Image
                  src={p.imagen}
                  alt=""
                  width={400}
                  height={280}
                  className="h-28 w-full object-cover"
                />
              ) : (
                <div className="flex h-28 w-full items-center justify-center bg-muted">
                  <span className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
                    Sin foto
                  </span>
                </div>
              )}
              <div className="p-3">
                <p className="font-heading truncate text-base">{p.nombre}</p>
                <p className="mt-1 text-base font-semibold">
                  {precioDeProducto(p.modo, p.precio_desde, p.unidad)}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {p.proveedor_nombre}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
