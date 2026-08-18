import 'server-only'
import { createServiceClient, nombreMunicipio } from '@/lib/backend/servicio'
import { notificarRespuesta } from '@/lib/push'
import { notificarOfertadores } from '@/lib/push-ofertadores'
import { notificarConversacion, notificarAcompanamiento } from '@/lib/push-coordinacion'
import { CATEGORIAS_ETIQUETA } from '@/lib/categorias'
import type { Json } from '@/lib/types'

// La etiqueta legible de cada categoría, resuelta aquí y no en la base: el
// worker corre sin petición, así que arma él los textos y las URLs. Los
// datos salen de `categorias.ts` (sin UI): no se importa `catalogo.ts`
// porque arrastra iconos de lucide-react, y un worker de push no carga UI.
const ETIQUETA = new Map<string, string>(CATEGORIAS_ETIQUETA.map((c) => [c.valor, c.etiqueta]))

export type TipoAviso = 'respuesta' | 'ofertadores' | 'conversacion' | 'acompanamiento'
export type PlantillaConversacion = 'mensaje_nuevo' | 'invitacion' | 'entrega_directa'

// `tipo` es `string`, no `TipoAviso`, a propósito: la columna es `text` y el
// drenado tiene que tolerar un valor que no reconoce (se deja para reintento
// y a los 5 intentos se abandona). Ese es el «tipo desconocido» de la prueba.
export interface AvisoPendiente {
  id: string
  tipo: string
  payload: Json
}

// Textos de conversación. Los mismos que antes armaban las rutas
// /api/mensajes y /api/invitaciones, movidos aquí sin cambio.
const TEXTO_CONVERSACION: Record<PlantillaConversacion, (codigo: string) => string> = {
  mensaje_nuevo: (codigo) => `Hay un mensaje nuevo en la coordinación de ${codigo}`,
  invitacion: (codigo) => `Te invitaron a coordinar la entrega de ${codigo}`,
  entrega_directa: (codigo) => `La fundación va a coordinar la entrega de ${codigo}`,
}

// El worker no tiene petición de la que sacar el origen: lo toma del entorno.
// Un valor equivocado manda las URLs de las notificaciones al host errado
// (documentado). Sin valor, cae al origen de producción.
function sitio(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aquive.co'
}

// ---------------------------------------------------------------------
// Costura de dependencias. `drenarAvisos()` usa las reales; las pruebas le
// pasan espías para no tocar la base ni la red. Mismo patrón que `limitar`.
// ---------------------------------------------------------------------
export interface DrenarDeps {
  reclamar: (limite: number) => Promise<AvisoPendiente[]>
  marcar: (id: string) => Promise<void>
  notificarRespuesta: typeof notificarRespuesta
  notificarOfertadores: typeof notificarOfertadores
  notificarConversacion: typeof notificarConversacion
  notificarAcompanamiento: typeof notificarAcompanamiento
  nombreMunicipio: typeof nombreMunicipio
}

const depsReales: DrenarDeps = {
  reclamar: async (limite) => {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('reclamar_avisos', { p_limite: limite })
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => ({ id: r.id, tipo: r.tipo, payload: r.payload }))
  },
  marcar: async (id) => {
    const supabase = createServiceClient()
    const { error } = await supabase.rpc('marcar_aviso_procesado', { p_id: id })
    if (error) throw new Error(error.message)
  },
  notificarRespuesta,
  notificarOfertadores,
  notificarConversacion,
  notificarAcompanamiento,
  nombreMunicipio,
}

// --- Lectura del payload con estrechamiento, sin `any` (regla de tipos) ---

function comoObjeto(payload: Json): { [k: string]: Json | undefined } {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('payload de aviso no es un objeto')
  }
  return payload
}

function comoTexto(valor: Json | undefined): string {
  if (typeof valor !== 'string') throw new Error('falta un campo de texto en el aviso')
  return valor
}

function textoOpcional(valor: Json | undefined): string | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor !== 'string') throw new Error('campo opcional con tipo inválido')
  return valor
}

function listaDeTextos(valor: Json | undefined): string[] {
  if (!Array.isArray(valor)) return []
  return valor.filter((x): x is string => typeof x === 'string')
}

function esPlantilla(valor: string): valor is PlantillaConversacion {
  return valor === 'mensaje_nuevo' || valor === 'invitacion' || valor === 'entrega_directa'
}

async function despachar(aviso: AvisoPendiente, deps: DrenarDeps): Promise<void> {
  switch (aviso.tipo) {
    case 'respuesta': {
      const o = comoObjeto(aviso.payload)
      const solicitudId = comoTexto(o.solicitud_id)
      const codigo = comoTexto(o.codigo)
      await deps.notificarRespuesta(solicitudId, codigo, `${sitio()}/mis-solicitudes`)
      return
    }
    case 'ofertadores': {
      const o = comoObjeto(aviso.payload)
      const municipioCodigo = comoTexto(o.municipio_codigo)
      const nombre = await deps.nombreMunicipio(municipioCodigo)
      // Sin municipio no hay a quién ubicar el aviso; se marca procesado
      // igual para que no reintente en vano.
      if (!nombre) return
      const etiqueta = ETIQUETA.get(comoTexto(o.categoria)) ?? 'insumos'
      await deps.notificarOfertadores(municipioCodigo, nombre, etiqueta, listaDeTextos(o.item_ids))
      return
    }
    case 'conversacion': {
      const o = comoObjeto(aviso.payload)
      const plantilla = comoTexto(o.plantilla)
      if (!esPlantilla(plantilla)) throw new Error(`plantilla desconocida: ${plantilla}`)
      await deps.notificarConversacion(
        comoTexto(o.conversacion_id),
        TEXTO_CONVERSACION[plantilla],
        sitio(),
        {
          perfilId: textoOpcional(o.excluir_perfil) ?? undefined,
          solicitante: o.excluir_solicitante === true,
        },
      )
      return
    }
    case 'acompanamiento': {
      const o = comoObjeto(aviso.payload)
      const solicitudId = comoTexto(o.solicitud_id)
      const codigo = comoTexto(o.codigo)
      await deps.notificarAcompanamiento(solicitudId, codigo, `${sitio()}/responder/${codigo}`)
      return
    }
    default:
      throw new Error(`tipo de aviso desconocido: ${aviso.tipo}`)
  }
}

/**
 * Reclama un lote de avisos, los despacha a las libs push existentes y
 * borra los que salieron. Los que fallan quedan para el próximo tic (hasta
 * 5 intentos, tope que impone `reclamar_avisos`). Devuelve cuántos se
 * procesaron. Nunca lanza por un aviso suelto.
 */
export async function drenarAvisos(
  limite = 50,
  deps: DrenarDeps = depsReales,
): Promise<{ procesados: number }> {
  const avisos = await deps.reclamar(limite)
  let procesados = 0
  for (const aviso of avisos) {
    try {
      await despachar(aviso, deps)
      await deps.marcar(aviso.id)
      procesados++
    } catch {
      // Best-effort: queda para el próximo tic. No se loggea nada (regla 6).
    }
  }
  return { procesados }
}
