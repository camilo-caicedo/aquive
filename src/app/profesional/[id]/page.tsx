import { notFound } from 'next/navigation'

import { servidor } from '@/orpc/local'
import { MarcoFlujo } from '@/components/marco-flujo'
import { FichaProfesional } from '@/app/profesionales/ficha-profesional'

export const metadata = { title: 'Profesional' }

/**
 * Un profesional con matrícula, él solo.
 *
 * Existe porque tocarlo en la portada llevaba a `/profesionales#p-<id>`: el
 * directorio entero, con un ancla que acierta si la lista ya está pintada y
 * falla si todavía está cargando. Ahora hay un sitio al que llegar.
 *
 * En singular —`/profesional/<id>`, no `/profesionales/<id>`— por lo mismo
 * que la ficha del prestador vive en `/prestador/<id>`: un segmento dinámico
 * con hermanos estáticos no se puede interceptar, y esto tiene que abrirse
 * como hoja encima de la lista.
 *
 * El nombre va en el título del flujo y no dentro de la ficha: repetido dos
 * veces seguidas se lee como si fueran dos personas.
 */
export default async function ProfesionalPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const profesional = await servidor.servicios.profesional({ id })
  if (!profesional) notFound()

  return (
    <MarcoFlujo titulo={profesional.nombre_visible} volver="/profesionales">
      <FichaProfesional profesional={profesional} mostrarNombre={false} />
    </MarcoFlujo>
  )
}
