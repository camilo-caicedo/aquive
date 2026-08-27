import { and, desc, eq, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { catalogoItems, solicitudItems, solicitudes, sugerenciasItem } from '@/db/esquema'
import { contienePII, validarNota } from '@/lib/validacion'
import type { MiSolicitudInsumos } from '@/contrato/insumos'

export class InsumoRechazado extends Error {}

/**
 * Pedir insumos. El módulo que nació con el sismo del 10 de agosto de 2026.
 *
 * ⚠ Esto era `crear_solicitud`, una función de PL/pgSQL a la que se le
 * pasaba un token en claro. Sube al dominio por el ADR 0001, y hubo que
 * subirlo ya porque el ADR 0006 le quitó la columna sobre la que escribía.
 *
 * ⚠ Lo que se le pide a quien pide NO cambió: municipio, barrio, categoría,
 * los ítems y la nota filtrada. Ni nombre, ni teléfono, ni dirección exacta.
 * Tener cuenta no es dar datos.
 *
 * ⚠ Se retiró `flujo` y `organizacion_id` de la escritura: eran del flujo
 * acompañado, que se va con el ADR 0007. Las columnas siguen en la tabla
 * hasta esa fase; aquí simplemente no se tocan.
 */

/** Cuatro letras y dos dígitos, para decirlo por teléfono sin deletrear. */
function nuevoCodigo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // sin I ni O: se confunden con 1 y 0
  let codigo = ''
  for (let i = 0; i < 4; i++) {
    codigo += letras[Math.floor(Math.random() * letras.length)]
  }
  return codigo + String(Math.floor(Math.random() * 100)).padStart(2, '0')
}

export async function publicar(
  db: BaseDeDatos,
  entrada: {
    municipio: string
    barrio: string
    categoria: string
    nota?: string
    puede_recoger?: boolean
    items: { item_id?: string; sugerencia?: string; cantidad: number }[]
  },
  llave: { usuarioId: string | null },
): Promise<{ id: string; codigo: string }> {
  if (!llave.usuarioId) {
    throw new InsumoRechazado('Para pedir ayuda necesitas entrar con tu cuenta.')
  }

  // Los campos libres, con su filtro (regla de producto 4). El barrio es
  // por donde más fácil se cuela un dato: «El Vergel, casa de la esquina,
  // pregunte por…».
  for (const texto of [entrada.barrio, entrada.nota ?? '']) {
    if (texto && contienePII(texto)) {
      throw new InsumoRechazado(
        'No escribas nombres, teléfonos ni direcciones exactas. Con el barrio basta.',
      )
    }
  }
  if (entrada.nota) {
    const error = validarNota(entrada.nota)
    if (error) throw new InsumoRechazado(error)
  }

  if (entrada.items.length === 0) {
    throw new InsumoRechazado('Elige al menos una cosa de la lista.')
  }
  if (entrada.items.length > 20) {
    throw new InsumoRechazado('Máximo veinte cosas por solicitud.')
  }

  for (let intento = 0; intento < 5; intento++) {
    const codigo = nuevoCodigo()
    const [ya] = await db
      .select({ id: solicitudes.id })
      .from(solicitudes)
      .where(eq(solicitudes.codigo, codigo))
      .limit(1)
    if (ya) continue

    const [fila] = await db
      .insert(solicitudes)
      .values({
        codigo,
        perfilId: llave.usuarioId,
        municipio: entrada.municipio,
        barrio: entrada.barrio,
        categoria: entrada.categoria,
        nota: entrada.nota ?? null,
        puedeRecoger: entrada.puede_recoger ?? false,
      })
      .returning({ id: solicitudes.id })

    for (const item of entrada.items) {
      // Del catálogo o sugerido, nunca los dos: lo mismo que sostiene el
      // `check` de `solicitud_items`.
      if (item.item_id) {
        const [existe] = await db
          .select({ id: catalogoItems.id })
          .from(catalogoItems)
          .where(and(eq(catalogoItems.id, item.item_id), eq(catalogoItems.activo, true)))
          .limit(1)
        if (!existe) continue

        await db.insert(solicitudItems).values({
          solicitudId: fila.id,
          itemId: item.item_id,
          cantidad: String(item.cantidad),
        })
      } else if (item.sugerencia) {
        if (contienePII(item.sugerencia)) {
          throw new InsumoRechazado(
            'Lo que escribas ahí lo va a leer un desconocido: no pongas datos tuyos.',
          )
        }
        const [sug] = await db
          .insert(sugerenciasItem)
          // `origen` dice de dónde vino la propuesta: la revisa un admin
          // antes de que entre al catálogo.
          .values({ nombrePropuesto: item.sugerencia, origen: 'solicitud' })
          .returning({ id: sugerenciasItem.id })

        await db.insert(solicitudItems).values({
          solicitudId: fila.id,
          sugerenciaId: sug.id,
          cantidad: String(item.cantidad),
        })
      }
    }

    return { id: fila.id, codigo }
  }

  throw new InsumoRechazado('No se pudo generar el código. Inténtalo otra vez.')
}

/** Las mías, para el perfil. */
export async function mias(
  db: BaseDeDatos,
  llave: { usuarioId: string | null },
): Promise<MiSolicitudInsumos[]> {
  if (!llave.usuarioId) return []

  const filas = await db
    .select({
      id: solicitudes.id,
      codigo: solicitudes.codigo,
      barrio: solicitudes.barrio,
      categoria: solicitudes.categoria,
      estado: solicitudes.estado,
      creada_at: solicitudes.creadaAt,
      expira_at: solicitudes.expiraAt,
    })
    .from(solicitudes)
    .where(eq(solicitudes.perfilId, llave.usuarioId))
    .orderBy(desc(solicitudes.creadaAt))

  return filas.map((f) => ({
    id: f.id,
    codigo: f.codigo,
    barrio: f.barrio,
    categoria: f.categoria,
    estado: f.estado,
    creada_at: String(f.creada_at),
    expira_at: String(f.expira_at),
  }))
}

/**
 * Renovar por otras 72 horas, o cerrar.
 *
 * ⚠ El `where` lleva SIEMPRE el perfil: es lo que impide cerrar la
 * solicitud de otro sabiendo su id, y va en la consulta y no en un `if`.
 */
export async function gestionar(
  db: BaseDeDatos,
  id: string,
  accion: 'renovar' | 'cerrar',
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) throw new InsumoRechazado('Esto no es tuyo.')

  const filas = await db
    .update(solicitudes)
    .set(
      accion === 'cerrar'
        ? { estado: 'cerrada' }
        : {
            expiraAt: sql`now() + interval '72 hours'`,
            confirmadaAt: sql`now()`,
            estado: 'abierta',
          },
    )
    .where(and(eq(solicitudes.id, id), eq(solicitudes.perfilId, llave.usuarioId)))
    .returning({ id: solicitudes.id })

  if (filas.length === 0) throw new InsumoRechazado('Esto no es tuyo.')
  return { ok: true }
}
