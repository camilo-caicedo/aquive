import { Pestanas } from '@/components/pestanas'

export type VistaLoMio = 'solicitudes' | 'perfil' | 'respuestas' | 'ajustes'

/**
 * Las pestañas de «Lo mío», el cuarto destino de la barra.
 *
 * Reúne cosas que vivían en rutas sueltas y que nadie relacionaba: las
 * solicitudes guardadas en este teléfono, el perfil de quien ofrece, sus
 * respuestas y los ajustes de la cuenta. Son rutas distintas a propósito
 * —el estado vive en la URL y cada pestaña consulta solo lo suyo—; lo que
 * se unifica es por dónde se entra.
 *
 * ⚠ Las tres pestañas de cuenta solo se dibujan con sesión. `/registro`
 * rebota a `/login` sin ella, y ofrecer pestañas que echan a la calle a
 * quien publicó una solicitud sin cuenta —el rol central del sitio— es
 * peor que no ofrecer ninguna.
 */
export function PestanasLoMio({
  activa,
  conSesion,
  respuestas,
}: {
  activa: VistaLoMio
  conSesion: boolean
  /** Cuántas respuestas tiene, para el número de la pestaña. */
  respuestas?: number
}) {
  if (!conSesion) return null

  return (
    <div className="mt-4">
      <Pestanas
        etiqueta="Lo mío"
        pestanas={[
          {
            href: '/mis-solicitudes',
            etiqueta: 'Solicitudes',
            activa: activa === 'solicitudes',
          },
          { href: '/registro', etiqueta: 'Mi perfil', activa: activa === 'perfil' },
          {
            href: '/registro?ver=respuestas',
            etiqueta: 'Respuestas',
            activa: activa === 'respuestas',
            cuenta: respuestas,
          },
          {
            href: '/registro?ver=ajustes',
            etiqueta: 'Ajustes',
            activa: activa === 'ajustes',
          },
        ]}
      />
    </div>
  )
}
