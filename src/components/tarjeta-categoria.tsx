import fs from 'node:fs'
import path from 'node:path'
import Image from 'next/image'
import Link from 'next/link'

import { CINTA, TINTA_CINTA, familiaDe } from '@/lib/familias'

/**
 * Dónde se dejan caer las fotos de categoría, y en qué formato.
 *
 * `public/categorias/<slug>.webp` (o `.jpg` / `.png`, en ese orden de
 * prueba), un archivo por cada uno de los doce grupos de
 * `src/lib/familias.ts:28-41` — el nombre del archivo es el slug exacto:
 * `comida.webp`, `cuidado.webp`, etc.
 *
 * El cliente todavía no las entrega, así que esta función se ejecuta en el
 * servidor y comprueba si el archivo YA existe antes de pedirle a
 * `next/image` que lo sirva. Sin esto, una imagen que falta rompe la
 * pantalla entera en vez de caer con gracia a la cinta de color.
 */
function fotoDeCategoria(slug: string): string | null {
  for (const extension of ['webp', 'jpg', 'png']) {
    const ruta = path.join(process.cwd(), 'public', 'categorias', `${slug}.${extension}`)
    if (fs.existsSync(ruta)) return `/categorias/${slug}.${extension}`
  }
  return null
}

/**
 * Una categoría: foto grande + nombre corto, o la cinta de color de siempre
 * si la foto todavía no llegó.
 *
 * El nombre va SIEMPRE encima, con foto o sin ella (regla de interfaz 9: el
 * color nunca informa solo). Sobre la foto, el contraste lo da una capa de
 * `bg-foreground/*`, no un `bg-black/50` crudo: es la única forma de tocar
 * ese contraste sin colar un color fuera de la paleta.
 */
export function TarjetaCategoria({
  grupo,
  nombre,
  cuantos,
  href,
}: {
  grupo: string
  nombre: string
  cuantos: number
  href: string
}) {
  const familia = familiaDe(grupo)
  const foto = fotoDeCategoria(grupo)

  return (
    <Link
      href={href}
      className="pulsable-tarjeta shadow-canto relative block aspect-square overflow-hidden rounded-2xl transition-transform hover:-translate-y-0.5"
    >
      {foto ? (
        <>
          <Image
            src={foto}
            alt=""
            fill
            sizes="(min-width: 640px) 200px, 33vw"
            className="object-cover"
          />
          {/* Degradado desde abajo, no una capa plana. Una capa uniforme
              al 45% deja el nombre legible, sí, pero apaga la foto entera
              —y la foto está aquí justamente para que alguien reconozca su
              categoría sin leer, que es lo que el cliente pidió el 3 de
              septiembre de 2026 pensando en gente mayor—. Así la imagen se
              ve limpia arriba y la tinta blanca se apoya abajo, donde el
              degradado llega a `/90` sobre `--foreground` `#1D1D1B`. */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/35 to-foreground/5"
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 p-2.5">
            <p className="font-heading text-sm leading-tight font-extrabold text-balance text-white">
              {nombre}
            </p>
            <p className="text-xs font-semibold text-white/90">
              {cuantos} {cuantos === 1 ? 'persona' : 'personas'}
            </p>
          </div>
        </>
      ) : (
        <div
          className={`flex h-full flex-col justify-between p-2.5 ${CINTA[familia]} ${TINTA_CINTA[familia]}`}
        >
          <p className="font-heading text-sm leading-tight font-extrabold text-balance">
            {nombre}
          </p>
          <p className="text-xs font-semibold">
            {cuantos} {cuantos === 1 ? 'persona' : 'personas'}
          </p>
        </div>
      )}
    </Link>
  )
}
