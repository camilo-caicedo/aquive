import { sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { acopiosPublicos } from '@/db/esquema'
import type { Acopio } from '@/contrato/acopios'

/**
 * Los centros de acopio que se pueden enseñar (ADR 0008).
 *
 * Se lee de `acopios_publicos` y nunca de la tabla: el filtro de `activa`
 * vive en la vista, y duplicarlo en cada consulta es cómo un día una copia
 * se olvida y aparece en la lista un centro que cerró.
 */
export async function lista(
  db: BaseDeDatos,
  filtros: { municipio?: string },
): Promise<Acopio[]> {
  const filas = await db
    .select()
    .from(acopiosPublicos)
    .where(
      // El municipio va dentro del arreglo: un centro puede operar en
      // varios, y tiene que salir en todos ellos.
      filtros.municipio
        ? sql`${acopiosPublicos.municipios} @> array[${filtros.municipio}]::text[]`
        : undefined,
    )
    .orderBy(acopiosPublicos.nombre)

  return filas.map((f) => ({
    id: f.id!,
    nombre: f.nombre ?? '',
    tipo: f.tipo ?? 'otra',
    municipios: f.municipios ?? [],
    direccion: f.direccionAcopio,
    horario: f.horarioAcopio,
    telefono: f.telefono,
    // `numeric` llega como texto desde Postgres, que es lo correcto: no
    // cabe en un `number` sin perder precisión. Una coordenada sí cabe.
    latitud: f.latitud === null ? null : Number(f.latitud),
    longitud: f.longitud === null ? null : Number(f.longitud),
  }))
}
