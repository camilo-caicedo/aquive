import Link from 'next/link'
import { Info } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { MapaDeProveedores } from '@/components/mapa-de-proveedores'
import { NOMBRE_GRUPO } from '@/contrato/servicios'

export const metadata = { title: 'Mapa' }

/**
 * El mapa de prestadores. Pantalla 08, en su versión de mapa real.
 *
 * Cada pin es una persona, por decisión del responsable del 26 de agosto de
 * 2026 (ADR 0004). Solo aparecen quienes lo autorizaron expresamente: el
 * consentimiento es aparte del de publicar nombre y teléfono, y la vista
 * pública devuelve las coordenadas en NULL para quien no lo dio.
 *
 * Los mismos filtros de la portada, para que «modistas en la comuna 3» se vea
 * igual en lista y en mapa y el enlace siga sirviendo.
 */
export default async function MapaPage({
  searchParams,
}: {
  searchParams: Promise<{
    oficio?: string
    grupo?: string
    municipio?: string
    zona?: string
  }>
}) {
  const params = await searchParams
  const { filas } = await servidor.servicios.directorio({
    oficio: params.oficio || undefined,
    grupo: params.grupo || undefined,
    municipio: params.municipio || undefined,
    zona: params.zona || undefined,
  })

  const enElMapa = filas.filter((f) => f.latitud !== null && f.longitud !== null)
  const fuera = filas.length - enElMapa.length

  const consulta = new URLSearchParams(
    Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
  ).toString()

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Mapa" volver={consulta ? `/directorio?${consulta}` : '/directorio'} />

      <p className="text-base text-muted-foreground">
        {enElMapa.length} {enElMapa.length === 1 ? 'persona' : 'personas'} en el mapa
        {params.grupo && NOMBRE_GRUPO[params.grupo]
          ? ` · ${NOMBRE_GRUPO[params.grupo]}`
          : ''}
      </p>

      <div className="mt-4">
        <MapaDeProveedores proveedores={enElMapa} />
      </div>

      {/* Lo que el mapa NO enseña, dicho donde se está mirando el mapa. Sin
          esto, quien ve seis pines cree que hay seis personas y las otras
          ocho no existen. */}
      {fuera > 0 && (
        <p className="mt-4 flex items-start gap-2 text-base text-muted-foreground">
          <Info className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
          <span>
            {fuera === 1
              ? 'Hay 1 persona más que no puso su ubicación en el mapa.'
              : `Hay ${fuera} personas más que no pusieron su ubicación en el mapa.`}{' '}
            Aparecen en{' '}
            <Link
              href={consulta ? `/?${consulta}` : '/'}
              className="text-enlace underline underline-offset-4"
            >
              la lista
            </Link>
            .
          </span>
        </p>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        Cada persona decidió si aparecer aquí y dónde poner su pin. Marcar un
        punto en el mapa no es una dirección exacta ni una invitación a
        presentarse sin avisar: el trabajo se acuerda antes, por chat o por
        teléfono.
      </p>
    </main>
  )
}
