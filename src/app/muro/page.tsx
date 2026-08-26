import Link from 'next/link'
import Image from 'next/image'
import { Plus } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { AccionPrincipal } from '@/components/accion-principal'
import { NOMBRE_CATEGORIA_MURO, type Cara } from '@/contrato/comunidad'
import { CINTA, SOMBRA_CARTEL, TINTA_CINTA, type Familia } from '@/lib/familias'

export const metadata = { title: 'Muro' }

// Las categorías del muro no son oficios, así que no tienen familia propia.
// El color rota y NO informa: la palabra de la categoría va siempre escrita
// en la cinta, que es lo que dice de qué se trata.
const COLORES: Familia[] = ['amarillo', 'verde', 'rojo', 'azul']

/**
 * Pantalla 30. Las dos caras del muro: lo que sobra y lo que falta.
 *
 * ⚠ La asimetría entre las caras no es de presentación. Quien OFRECE publica
 * con su nombre, porque aceptó que fuera público. Quien NECESITA no da un
 * solo dato y vuelve con un token — igual que una solicitud de insumos.
 * La base lo sostiene con dos CHECK; aquí solo se pinta.
 */
export default async function MuroPage({
  searchParams,
}: {
  searchParams: Promise<{ cara?: string; municipio?: string; categoria?: string }>
}) {
  const params = await searchParams
  const cara: Cara = params.cara === 'necesita' ? 'necesita' : 'ofrece'

  const publicaciones = await servidor.comunidad.muro({
    cara,
    municipio: params.municipio,
    categoria: params.categoria,
  })

  const otra = cara === 'ofrece' ? 'necesita' : 'ofrece'

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Muro" />
      <p className="text-base text-muted-foreground">
        Dos caras del mismo muro: quien tiene algo que dar y quien necesita
        algo. Se acuerda por chat y no pasa dinero por aquí.
      </p>

      {/* Segmentado: la segunda capa de navegación, y la única (regla 3). */}
      <div
        role="tablist"
        aria-label="Caras del muro"
        className="riel mt-4 flex gap-2 overflow-x-auto"
      >
        {(['ofrece', 'necesita'] as const).map((c) => (
          <Link
            key={c}
            role="tab"
            aria-selected={cara === c}
            href={`/muro?cara=${c}`}
            className={`inline-flex min-h-12 shrink-0 items-center rounded-full px-5 text-base transition-colors ${
              cara === c
                ? 'bg-foreground font-semibold text-background'
                : 'shadow-canto bg-card hover:bg-muted'
            }`}
          >
            {c === 'ofrece' ? 'Se ofrece' : 'Se necesita'}
          </Link>
        ))}
      </div>

      {publicaciones.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-base text-muted-foreground">
            {cara === 'ofrece'
              ? 'Todavía nadie ha publicado algo para dar.'
              : 'Todavía nadie ha publicado algo que necesite.'}
          </p>
          <Link
            href={`/muro?cara=${otra}`}
            className="text-enlace mt-3 inline-block text-base underline underline-offset-4"
          >
            Ver la otra cara
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {publicaciones.map((p, i) => {
            const familia = COLORES[i % COLORES.length]
            return (
              <li
                key={p.id}
                className={`overflow-hidden rounded-2xl bg-card ${SOMBRA_CARTEL[familia]}`}
              >
                <div
                  className={`flex items-center justify-between gap-2 px-4 py-2 ${CINTA[familia]} ${TINTA_CINTA[familia]}`}
                >
                  <span className="font-heading text-xs tracking-[0.085em] uppercase">
                    {NOMBRE_CATEGORIA_MURO[p.categoria] ?? p.categoria}
                  </span>
                  <span className="text-sm">
                    {[p.zona_nombre, p.municipio_nombre].filter(Boolean).join(' · ')}
                  </span>
                </div>

                {p.imagen && (
                  <Image
                    src={p.imagen}
                    alt=""
                    width={800}
                    height={450}
                    className="h-48 w-full object-cover"
                  />
                )}

                <div className="p-4">
                  <h2 className="font-heading text-lg leading-tight">{p.titulo}</h2>
                  {p.detalle && (
                    <p className="mt-1 line-clamp-3 text-base text-muted-foreground">
                      {p.detalle}
                    </p>
                  )}
                  {/* Solo la cara que ofrece tiene nombre. En la otra ni
                      siquiera existe el campo, así que no hay nada que
                      esconder aquí. */}
                  {p.autor_nombre && (
                    <p className="mt-2 text-base font-medium">{p.autor_nombre}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        {cara === 'necesita'
          ? 'Una necesidad se borra sola a los 15 días, con todo lo que lleva dentro. Publicar no exige cuenta ni dar tus datos.'
          : 'Las donaciones se quedan mientras quien publicó las deje. Tu nombre aparece porque lo autorizaste, y puedes borrarlas cuando quieras.'}
      </p>

      <AccionPrincipal
        etiqueta={cara === 'ofrece' ? 'Ofrecer algo' : 'Pedir lo que me falta'}
        Icono={Plus}
        href={`/muro/publicar?cara=${cara}`}
      />
    </main>
  )
}
