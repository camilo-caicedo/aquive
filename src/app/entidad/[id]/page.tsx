import { notFound } from 'next/navigation'

import { servidor } from '@/orpc/local'
import { AVISO_ENTIDADES } from '@/lib/honestidad'
import { MarcoFlujo } from '@/components/marco-flujo'
import { FichaEntidad } from '@/app/entidades/ficha-entidad'

export const metadata = { title: 'Entidad' }

/**
 * Una organización del directorio, ella sola. Mismo motivo y mismo singular
 * que `/profesional/<id>`.
 *
 * El aviso de qué NO es esta lista viaja con la ficha. En `/entidades` está
 * arriba del todo y se lee una vez; aquí se llega directo desde la portada,
 * sin pasar por él, y sin el aviso una entidad se lee como un prestador más.
 */
export default async function EntidadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const entidad = await servidor.servicios.entidad({ id })
  if (!entidad) notFound()

  return (
    <MarcoFlujo titulo={entidad.nombre} volver="/entidades">
      <p className="text-sm text-muted-foreground">{AVISO_ENTIDADES}</p>
      <div className="mt-4">
        <FichaEntidad entidad={entidad} mostrarNombre={false} />
      </div>
    </MarcoFlujo>
  )
}
