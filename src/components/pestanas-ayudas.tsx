import { Pestanas } from '@/components/pestanas'

/**
 * Los tres lados de la ayuda de emergencia, bajo un solo destino.
 *
 * Quién necesita insumos, qué puedo dar yo, y quién los está ofreciendo.
 * Antes eran dos destinos de la barra —«Solicitudes» y «Quién ofrece»— más
 * un segmentado propio dentro del primero: tres capas de navegación para
 * tres listas de la misma pregunta.
 *
 * ⚠ «Quién ofrece» sigue viviendo en /ofertadores y no se mudó aquí. Es el
 * mismo trato que `PestanasServicios` hace con Oficios, Profesionales y
 * Entidades: son rutas distintas, con consultas distintas, y lo que se
 * unifica es por dónde se entra, no lo que hay detrás.
 */
const RUTAS = {
  necesitan: '/ayudas',
  tengo: '/ayudas?modo=tengo',
  ofrecen: '/ofertadores',
} as const

export type PestanaAyudas = keyof typeof RUTAS

export function PestanasAyudas({ activa }: { activa: PestanaAyudas }) {
  return (
    <div className="mt-3">
      <Pestanas
        etiqueta="Qué lado de la ayuda ver"
        pestanas={[
          {
            href: RUTAS.necesitan,
            etiqueta: 'Quién necesita',
            activa: activa === 'necesitan',
          },
          {
            href: RUTAS.tengo,
            etiqueta: 'Lo que puedo dar',
            activa: activa === 'tengo',
          },
          {
            href: RUTAS.ofrecen,
            etiqueta: 'Quién ofrece',
            activa: activa === 'ofrecen',
          },
        ]}
      />
    </div>
  )
}
