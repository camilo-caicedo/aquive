import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { InsigniasProveedor } from '@/components/insignias-proveedor'
import { precioLegible, zonaLegible, etiquetaModalidad } from '@/lib/servicios'
import type { Database, ModoPrecio, UnidadPrecio } from '@/lib/types'

type ProveedorPublico = Database['public']['Views']['proveedores_publicos']['Row']

/**
 * La tarjeta del directorio. No lleva el teléfono ni el botón de
 * contactar: el contacto es una decisión y se toma en la ficha, después
 * de leer las insignias y el aviso de seguridad. Un botón de WhatsApp en
 * una lista invita a escribirle a cinco personas sin mirar a ninguna.
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

  return (
    <li className="rounded-lg border border-border p-4 sm:p-5">
      <Link
        href={`/servicios/${proveedor.id}`}
        className="text-lg font-bold underline-offset-4 hover:underline"
      >
        {proveedor.nombre_visible}
      </Link>

      <div className="mt-2">
        <InsigniasProveedor
          telefonoVerificado={proveedor.telefono_verificado}
          referenciasConfirmadas={proveedor.referencias_confirmadas}
          esMicroempresa={proveedor.tipo === 'microempresa'}
          serviciosConfirmados={proveedor.servicios_confirmados}
        />
      </div>

      <ul className="mt-3 space-y-1">
        {oficios.map((o) => (
          <li key={o.oficio_id} className="flex flex-wrap items-baseline gap-x-2 text-base">
            <span>{o.oficio_nombre}</span>
            <span className="text-sm text-muted-foreground">
              {precioLegible(o.modo, o.precio_desde, o.unidad)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
        <MapPin className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
        <span>
          {[zona, nombreMunicipio].filter(Boolean).join(' · ')}
          {proveedor.modalidad.length > 0 &&
            ` · ${proveedor.modalidad.map(etiquetaModalidad).join(', ').toLowerCase()}`}
        </span>
      </p>

      {proveedor.descripcion && (
        <p className="mt-2 line-clamp-2 text-base">{proveedor.descripcion}</p>
      )}

      <Link
        href={`/servicios/${proveedor.id}`}
        className="mt-3 inline-flex min-h-12 items-center text-base underline underline-offset-4"
      >
        Ver y contactar
      </Link>
    </li>
  )
}
