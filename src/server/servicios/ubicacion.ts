import { createHash } from 'node:crypto'

import { eq } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { proveedores } from '@/db/esquema'

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
 * Identifica al prestador por sesión o por token, igual que el chat: quien
 * fue dado de alta por la fundación no tiene cuenta, y su token es su puerta
 * de habeas data — sin él no podría ni ponerse ni quitarse del mapa.
 */
export async function guardarUbicacion(
  db: BaseDeDatos,
  entrada: { acepto: boolean; latitud: number | null; longitud: number | null },
  llave: { token?: string; usuarioId: string | null },
): Promise<{ ok: true }> {
  const condicion = llave.token
    ? eq(proveedores.tokenHash, createHash('sha256').update(llave.token).digest('hex'))
    : llave.usuarioId
      ? eq(proveedores.perfilId, llave.usuarioId)
      : null

  if (!condicion) throw new UbicacionRechazada('No se pudo identificar tu ficha.')

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
  llave: { token?: string; usuarioId: string | null },
): Promise<{ latitud: number | null; longitud: number | null; acepto: boolean } | null> {
  const condicion = llave.token
    ? eq(proveedores.tokenHash, createHash('sha256').update(llave.token).digest('hex'))
    : llave.usuarioId
      ? eq(proveedores.perfilId, llave.usuarioId)
      : null

  if (!condicion) return null

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
