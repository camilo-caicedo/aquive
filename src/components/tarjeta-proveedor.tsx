import Link from 'next/link'
import { InsigniasProveedor } from '@/components/insignias-proveedor'
import { Button } from '@/components/ui/button'
import { precioLegible, zonaLegible, etiquetaModalidad } from '@/lib/servicios'
import type { Database, ModoPrecio, UnidadPrecio } from '@/lib/types'

type ProveedorPublico = Database['public']['Views']['proveedores_publicos']['Row']

/**
 * La tarjeta del directorio. No lleva el teléfono ni un botón de WhatsApp:
 * el contacto es una decisión y se toma en la ficha, después de leer las
 * insignias y el aviso de seguridad. Un botón de WhatsApp en una lista
 * invita a escribirle a cinco personas sin mirar a ninguna.
 *
 * Lo que sí lleva es un botón para entrar, de ancho completo: antes era un
 * enlace subrayado del tamaño del texto, al final de la tarjeta, y no se
 * leía como la salida de la tarjeta sino como una nota más.
 */
export function TarjetaProveedor({
  proveedor,
  nombreMunicipio,
  oficios,
}: {
  proveedor: ProveedorPublico
  nombreMunicipio?: string
  /** Los oficios de ESTE proveedor, con su precio. Vienen de la página. */
  oficios: {
    oficio_id: string
    oficio_nombre: string
    modo: ModoPrecio
    precio_desde: number | null
    unidad: UnidadPrecio | null
  }[]
}) {
  const zona = zonaLegible(proveedor.zona_nombre, proveedor.zona_texto)
  const donde = [zona, nombreMunicipio]
    .filter(Boolean)
    .concat(
      proveedor.modalidad.length > 0
        ? [proveedor.modalidad.map(etiquetaModalidad).join(', ').toLowerCase()]
        : []
    )
    .join(' · ')

  return (
    <li className="animar-entrada rounded-2xl bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/servicios/${proveedor.id}`}
            className="text-lg leading-tight font-bold underline-offset-4 hover:underline"
          >
            {proveedor.nombre_visible}
          </Link>
          {/* Dos líneas y corta: con zona, municipio, departamento y las
              tres modalidades, esto llegaba a cinco renglones y empujaba los
              precios —que es a lo que se viene— fuera de la tarjeta. */}
          <p className="mt-0.5 line-clamp-2 text-base text-muted-foreground">{donde}</p>
        </div>
        {/* El sello de teléfono verificado va arriba a la derecha, en la
            línea del nombre: es lo primero que se mira al comparar dos
            fichas. Las demás insignias van abajo, con el resto. */}
        <span className="shrink-0">
          <InsigniasProveedor
            mostrar="telefono"
            telefonoVerificado={proveedor.telefono_verificado}
            referenciasConfirmadas={proveedor.referencias_confirmadas}
            esMicroempresa={proveedor.tipo === 'microempresa'}
          />
        </span>
      </div>

      {/* El precio alineado a la derecha, no pegado al nombre del oficio:
          así se pueden comparar dos precios de un vistazo, que es lo que
          hace quien está eligiendo.

          ⚠ Pero solo desde `sm`. El precio era `shrink-0` en una fila que
          no envuelve, así que cuando lleva el prefijo largo —«Precio
          solidario: Desde $ 45.000 por prenda», que a 16 px no cabe ni
          solo en 360— se desbordaba hacia la izquierda y se imprimía
          ENCIMA del nombre del oficio. En el teléfono van apilados, que es
          lo único que cabe; comparar de un vistazo sigue funcionando en
          pantalla ancha, que es donde esa comparación se hacía. */}
      <ul className="mt-3 space-y-1.5">
        {oficios.map((o) => (
          <li
            key={o.oficio_id}
            className="flex flex-col gap-0.5 text-base sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
          >
            <span className="min-w-0">{o.oficio_nombre}</span>
            <span className="text-muted-foreground sm:shrink-0 sm:text-right">
              {precioLegible(o.modo, o.precio_desde, o.unidad)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <InsigniasProveedor
          mostrar="resto"
          telefonoVerificado={proveedor.telefono_verificado}
          referenciasConfirmadas={proveedor.referencias_confirmadas}
          esMicroempresa={proveedor.tipo === 'microempresa'}
          serviciosConfirmados={proveedor.servicios_confirmados}
        />
      </div>

      {proveedor.descripcion && (
        <p className="mt-3 line-clamp-2 text-base">{proveedor.descripcion}</p>
      )}

      <Button
        variant="outline"
        className="mt-4 w-full border-primary text-primary"
        nativeButton={false}
        render={<Link href={`/servicios/${proveedor.id}`} />}
      >
        Ver y contactar
      </Button>
    </li>
  )
}
