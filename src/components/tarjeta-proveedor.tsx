import Image from 'next/image'
import Link from 'next/link'
import { InsigniasProveedor } from '@/components/insignias-proveedor'
import { precioLegible, zonaLegible, etiquetaModalidad, GRUPOS } from '@/lib/servicios'
import { CINTA, SOMBRA_CARTEL, TINTA_CINTA, familiaDe } from '@/lib/familias'
import type { GrupoOficio } from '@/lib/types'
import type { EnListado } from '@/contrato/servicios'

/**
 * La tarjeta del directorio. No lleva el teléfono ni un botón de WhatsApp:
 * el contacto es una decisión y se toma en la ficha, después de leer las
 * insignias y el aviso de seguridad. Un botón de WhatsApp en una lista
 * invita a escribirle a cinco personas sin mirar a ninguna.
 *
 * La identidad la carga la sombra desplazada en el color de la familia del
 * oficio, no un contorno (ADR 0002). Y el color va SIEMPRE con la palabra
 * encima: la cinta dice «CONFECCIÓN» además de ser azul.
 *
 * Un solo argumento, y sale del contrato. Antes eran tres —la fila cruda de
 * la vista, el nombre del municipio y los oficios— y la pantalla tenía que
 * acordarse de cruzar los tres.
 */
export function TarjetaProveedor({ proveedor }: { proveedor: EnListado }) {
  const oficios = proveedor.oficios
  const zona = zonaLegible(proveedor.zona_nombre, proveedor.zona_texto)
  const donde = [zona, proveedor.municipio_nombre]
    .filter(Boolean)
    .concat(
      proveedor.modalidad.length > 0
        ? [proveedor.modalidad.map(etiquetaModalidad).join(', ').toLowerCase()]
        : [],
    )
    .join(' · ')

  // El grupo del primer oficio manda el color. Quien tiene varios oficios de
  // familias distintas se pinta con el primero por orden alfabético, que es
  // el mismo que se ve en la lista de abajo: el color y la primera línea
  // coinciden, y eso es lo que hace que el código de color se aprenda solo.
  const grupo = oficios[0]?.grupo ?? null
  const familia = familiaDe(grupo)
  const etiquetaGrupo = grupo ? (GRUPOS[grupo as GrupoOficio] ?? 'Oficios') : 'Oficios'

  return (
    <li
      className={`animar-entrada overflow-hidden rounded-2xl bg-card ${SOMBRA_CARTEL[familia]}`}
    >
      <div
        className={`flex items-center justify-between gap-2 px-4 py-2 ${CINTA[familia]} ${TINTA_CINTA[familia]}`}
      >
        <span className="font-heading text-xs font-bold tracking-[0.085em] uppercase">
          {etiquetaGrupo}
        </span>
        {/* El sello de teléfono verificado va en la cinta: es lo primero que
            se mira al comparar dos fichas. Las demás insignias van abajo. */}
        <span className="shrink-0">
          <InsigniasProveedor
            mostrar="telefono"
            telefonoVerificado={proveedor.telefono_verificado}
            referenciasConfirmadas={proveedor.referencias_confirmadas}
            esMicroempresa={proveedor.tipo === 'microempresa'}
          />
        </span>
      </div>

      <div className="flex gap-3 p-4">
        {/* La foto solo si la hay Y si esa persona autorizó publicarla — eso
            lo resuelve la vista, aquí llega en nulo o no llega.

            Sin foto NO se dibuja un hueco ni unas iniciales: la tarjeta sin
            foto ya es un diseño completo, y la mitad del rebusque no va a
            subir una nunca. Un marcador de posición convierte «no puso foto»
            en «le falta algo». */}
        {proveedor.foto && (
          <Image
            src={proveedor.foto}
            alt=""
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-full object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
        <Link
          href={`/prestador/${proveedor.id}`}
          className="font-heading text-lg leading-tight font-extrabold underline-offset-4 hover:underline"
        >
          {proveedor.nombre_visible}
        </Link>
        {/* Dos líneas y corta: con zona, municipio y las tres modalidades
            esto llegaba a cinco renglones y empujaba los precios —que es a
            lo que se viene— fuera de la tarjeta. */}
        <p className="mt-0.5 line-clamp-2 text-base text-muted-foreground">{donde}</p>

        {/* El precio alineado a la derecha, no pegado al nombre del oficio:
            así se comparan dos precios de un vistazo, que es lo que hace
            quien está eligiendo.

            ⚠ Pero solo desde `sm`. El precio era `shrink-0` en una fila que
            no envuelve, así que con el prefijo largo —«Precio solidario:
            Desde $ 45.000 por prenda», que a 16 px no cabe ni solo en 360—
            se desbordaba y se imprimía ENCIMA del nombre del oficio. */}
        <ul className="mt-3 space-y-1.5">
          {oficios.map((o) => (
            <li
              key={o.oficio_id}
              className="flex flex-col gap-0.5 text-base sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
            >
              <span className="min-w-0">{o.nombre}</span>
              <span className="text-muted-foreground sm:shrink-0 sm:text-right">
                {precioLegible(o.modo, o.precio_desde, o.unidad)}
              </span>
            </li>
          ))}
        </ul>

        {proveedor.descripcion && (
          <p className="mt-3 line-clamp-2 text-base">{proveedor.descripcion}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <InsigniasProveedor
            mostrar="resto"
            telefonoVerificado={proveedor.telefono_verificado}
            referenciasConfirmadas={proveedor.referencias_confirmadas}
            esMicroempresa={proveedor.tipo === 'microempresa'}
            serviciosConfirmados={proveedor.servicios_confirmados}
          />
          {/* Píldora blanca con canto, no un relleno lima: el lima es la
              acción principal de la pantalla, y en una lista de veinte
              tarjetas ninguna de las veinte lo es. */}
          <Link
            href={`/prestador/${proveedor.id}`}
            className="shadow-canto ml-auto inline-flex min-h-12 shrink-0 items-center rounded-full bg-card px-5 text-base font-semibold transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Ver ficha
          </Link>
        </div>
        </div>
      </div>
    </li>
  )
}
