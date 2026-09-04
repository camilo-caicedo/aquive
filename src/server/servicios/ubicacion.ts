import { and, eq, isNotNull, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { proveedores, proveedoresPublicos } from '@/db/esquema'

/**
 * La versión del texto de autorización de ubicación que se está aceptando.
 *
 * Se guarda con cada consentimiento. Cuando el texto cambie, sube el número:
 * el día que alguien pregunte qué autorizó, la respuesta tiene que decir qué
 * decía el papel ESE día, no el de hoy.
 */
export const VERSION_AUTORIZACION_MAPA = 'mapa-v1'

export class UbicacionRechazada extends Error {}

/**
 * Guardar o quitar el punto propio.
 *
 * Identifica al prestador por su cuenta, que desde el ADR 0006 es la única
 * manera de ser dueño de una ficha. Quien no tiene Google recibe la suya de
 * un admin, así que nadie se queda sin poder ponerse ni quitarse del mapa.
 */
export async function guardarUbicacion(
  db: BaseDeDatos,
  entrada: { acepto: boolean; latitud: number | null; longitud: number | null },
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) {
    throw new UbicacionRechazada('Para tocar tu ficha necesitas entrar con tu cuenta.')
  }
  const condicion = eq(proveedores.perfilId, llave.usuarioId)

  // Aceptar sin punto no significa nada, y el CHECK de la base lo rechazaría
  // con un error feo. Se atrapa aquí para poder decir qué falta.
  if (entrada.acepto && (entrada.latitud === null || entrada.longitud === null)) {
    throw new UbicacionRechazada('Toca el mapa para poner tu punto antes de aceptar.')
  }

  const actualizadas = await db
    .update(proveedores)
    .set(
      entrada.acepto
        ? {
            latitud: String(entrada.latitud),
            longitud: String(entrada.longitud),
            aceptoMapa: true,
            mapaVersion: VERSION_AUTORIZACION_MAPA,
            mapaAt: new Date().toISOString(),
          }
        : {
            // Quitarse del mapa BORRA el punto, no solo lo esconde. Guardar
            // una coordenada de alguien que retiró su permiso es exactamente
            // lo que la promesa de borrado dice que no se hace.
            latitud: null,
            longitud: null,
            aceptoMapa: false,
            mapaVersion: null,
            mapaAt: null,
          },
    )
    .where(condicion)
    .returning({ id: proveedores.id })

  if (actualizadas.length === 0) {
    throw new UbicacionRechazada('No encontramos tu ficha.')
  }

  return { ok: true }
}

/** El punto propio, leído de la tabla. Ver el comentario del contrato. */
export async function miUbicacion(
  db: BaseDeDatos,
  llave: { usuarioId: string | null },
): Promise<{ latitud: number | null; longitud: number | null; acepto: boolean } | null> {
  if (!llave.usuarioId) return null
  const condicion = eq(proveedores.perfilId, llave.usuarioId)

  const [fila] = await db
    .select({
      latitud: proveedores.latitud,
      longitud: proveedores.longitud,
      acepto: proveedores.aceptoMapa,
    })
    .from(proveedores)
    .where(condicion)
    .limit(1)

  if (!fila) return null

  return {
    latitud: fila.latitud === null ? null : Number(fila.latitud),
    longitud: fila.longitud === null ? null : Number(fila.longitud),
    acepto: fila.acepto,
  }
}

/**
 * Dónde centrar el mapa al elegir municipio (reporte de alta de ficha).
 *
 * `municipios` no tiene coordenadas propias, así que esto es el centroide de
 * quienes ya aceptaron el mapa en ese municipio —`proveedores_publicos` los
 * trae con `latitud`/`longitud`, `NULL` para quien no aceptó—. `null` si
 * todavía no hay ninguno: sin geocoding, no se inventa un punto (ADR 0004).
 */
export async function centroMunicipio(
  db: BaseDeDatos,
  municipio: string,
): Promise<{ latitud: number; longitud: number } | null> {
  const [fila] = await db
    .select({
      latitud: sql<number | null>`avg(${proveedoresPublicos.latitud})`,
      longitud: sql<number | null>`avg(${proveedoresPublicos.longitud})`,
    })
    .from(proveedoresPublicos)
    .where(
      and(eq(proveedoresPublicos.municipio, municipio), isNotNull(proveedoresPublicos.latitud)),
    )

  if (!fila || fila.latitud === null || fila.longitud === null) return null

  return { latitud: Number(fila.latitud), longitud: Number(fila.longitud) }
}
