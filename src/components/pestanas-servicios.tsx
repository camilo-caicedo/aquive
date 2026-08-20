import { Pestanas } from '@/components/pestanas'

/**
 * Las tres listas de «quién puede hacer algo por mí», bajo un solo
 * destino de la navegación.
 *
 * Son tres módulos distintos —rutas distintas, tablas distintas y, en el
 * caso de Oficios, otro responsable del tratamiento— pero para quien
 * busca son la misma pregunta, y la barra inferior tiene un tope de cinco
 * destinos. Lo que se unifica es por dónde se entra, no lo que hay
 * detrás.
 *
 * Usa `Pestanas` en vez de repetir el marcado: son las mismas pestañas
 * del resto del sitio, y tenerlas dos veces garantizaba que un día se
 * vieran distinto.
 */
const RUTAS = {
  oficios: '/',
  profesionales: '/servidores?ver=profesionales',
  entidades: '/servidores',
} as const

export type PestanaServicios = keyof typeof RUTAS

export function PestanasServicios({ activa }: { activa: PestanaServicios }) {
  return (
    <div className="mt-4">
      <Pestanas
        etiqueta="Qué lista ver"
        pestanas={[
          { href: RUTAS.oficios, etiqueta: 'Oficios', activa: activa === 'oficios' },
          {
            href: RUTAS.profesionales,
            etiqueta: 'Profesionales',
            activa: activa === 'profesionales',
          },
          { href: RUTAS.entidades, etiqueta: 'Entidades', activa: activa === 'entidades' },
        ]}
      />
    </div>
  )
}
