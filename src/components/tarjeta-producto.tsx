import Link from 'next/link'
import Image from 'next/image'
import { MessageCircle, Phone } from 'lucide-react'

import { enlaceWhatsapp } from '@/lib/contacto'
import { precioDeProducto } from '@/lib/servicios'
import { SOMBRA_CARTEL, familiaDe } from '@/lib/familias'
import type { Producto } from '@/contrato/comunidad'

/**
 * Un producto de «Hecho en el barrio».
 *
 * Lleva el contacto encima, no a dos pantallas: quien ve unos tamales que le
 * gustan quiere escribir, no leer una ficha. El teléfono es el mismo que esa
 * persona publicó en la suya, y el nombre lleva enlace por si quien compra
 * prefiere mirar antes con quién está hablando.
 *
 * ⚠ El precio se lee de `precioLegible`, el mismo de los oficios. Es lo que
 * mantiene «Precio solidario: desde $9.000 el plato» diciendo lo mismo en
 * todo el sitio, y lo que impide que aquí aparezca un precio inventado por
 * la pantalla.
 */
export function TarjetaProducto({ producto }: { producto: Producto }) {
  const familia = familiaDe(producto.grupos[0] ?? null)

  return (
    <li className={`overflow-hidden rounded-2xl bg-card ${SOMBRA_CARTEL[familia]}`}>
      {producto.imagen ? (
        <Image
          src={producto.imagen}
          alt=""
          width={600}
          height={400}
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-muted">
          <span className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
            Sin foto
          </span>
        </div>
      )}

      <div className="p-4">
        <h3 className="font-heading text-base leading-tight">{producto.nombre}</h3>

        <p className="mt-2 text-base font-semibold">
          {precioDeProducto(producto.modo, producto.precio_desde, producto.unidad)}
        </p>

        {producto.detalle && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {producto.detalle}
          </p>
        )}

        <p className="mt-2 text-sm text-muted-foreground">
          <Link
            href={`/prestador/${producto.proveedor_id}`}
            className="text-enlace underline-offset-4 hover:underline"
          >
            {producto.proveedor_nombre}
          </Link>
          {producto.zona_nombre ? ` · ${producto.zona_nombre}` : ''}
        </p>

        {/* Sin teléfono no se dibuja nada: mejor que un botón que no hace
            nada. En la práctica no pasa —la vista exige ficha publicada—,
            pero la columna admite nulo y la tarjeta no se cae por eso. */}
        {producto.telefono && (
          <div className="mt-3 flex items-center gap-2">
            <a
              href={enlaceWhatsapp(producto.telefono)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary text-primary-foreground shadow-boton active:shadow-boton-hundido inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 text-base font-semibold transition-all active:translate-x-[2px] active:translate-y-[2px]"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              Escribir
            </a>
            <a
              href={`tel:${producto.telefono}`}
              aria-label={`Llamar a ${producto.proveedor_nombre}`}
              className="border-enlace text-enlace hover:bg-accent flex size-12 shrink-0 items-center justify-center rounded-full border transition-colors"
            >
              <Phone className="size-5" aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    </li>
  )
}
