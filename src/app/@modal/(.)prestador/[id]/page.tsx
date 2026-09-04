import FichaPage from '@/app/prestador/[id]/page'
import { HojaModal } from '@/components/hoja-modal'

/**
 * La ficha, abierta encima de la lista.
 *
 * Se renderiza la MISMA página, sin copiar nada: lo único que cambia es el
 * caparazón. Dos versiones de una ficha que habla de matrículas y de
 * verificaciones se separarían en la primera corrección que se hiciera en
 * una sola de las dos.
 *
 * La flecha atrás de `MarcoFlujo` ya vuelve a la pantalla anterior, así que
 * dentro del modal cierra, que es lo que tiene que hacer.
 *
 * ⚠ La ficha vive en `/prestador/<id>` y no en `/servicios/<id>` por esto
 * mismo: un segmento dinámico con hermanos estáticos no se puede
 * interceptar. `(.)servicios/[id]` casaba también con
 * `/servicios/soy-proveedor` y le pasaba «soy-proveedor» al contrato como
 * si fuera un id.
 */
export default async function FichaInterceptada({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <HojaModal etiqueta="Ficha del prestador" ruta={`/prestador/${id}`}>
      {/* La promesa ya resuelta, para no volver a esperar lo mismo. */}
      <FichaPage params={Promise.resolve({ id })} />
    </HojaModal>
  )
}
