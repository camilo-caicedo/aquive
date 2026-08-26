import type { BaseDeDatos } from '@/db/cliente'
import { reportes } from '@/db/esquema'
import type { Motivo, TipoObjeto } from '@/contrato/moderacion'

// Capa de dominio de moderación. Sin `next/*`, como todas.

export async function reportar(
  db: BaseDeDatos,
  entrada: {
    tipo_objeto: TipoObjeto
    objeto_id: string
    motivo: Motivo
    nota?: string
  },
): Promise<{ ok: true }> {
  await db.insert(reportes).values({
    tipoObjeto: entrada.tipo_objeto,
    objetoId: entrada.objeto_id,
    motivo: entrada.motivo,
    // Una nota vacía es null y no cadena vacía: en la cola de moderación,
    // «(vacío)» y «sin nota» son la misma cosa y conviene que se vean igual.
    nota: entrada.nota && entrada.nota.length > 0 ? entrada.nota : null,
  })
  return { ok: true }
}
