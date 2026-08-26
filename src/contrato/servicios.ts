import { oc } from '@orpc/contract'
import { z } from 'zod'

// El contrato del módulo de Servicios: qué se puede pedir y qué vuelve.
//
// Vive aparte de su implementación a propósito (ADR 0001, regla 2). Este
// archivo no importa `next/*`, ni el pool de Postgres, ni nada del servidor:
// solo describe. Por eso el día que exista la aplicación de Expo puede
// depender de `src/contrato/` sin arrastrarse medio backend al build.
//
// Nombres en español, como las tablas y la interfaz.

// Estos enums son gemelos de los de `src/lib/types.ts` y de los CHECK de
// Postgres. El contrato describe la realidad, no la ensancha: si aquí
// dijeran `string`, cada pantalla tendría que volver a estrechar el tipo a
// mano y una de ellas se olvidaría.
export const Modo = z.enum(['gratis', 'aporte', 'solidario', 'normal'])
export const Unidad = z.enum(['hora', 'trabajo', 'dia', 'prenda', 'viaje', 'plato', 'unidad'])
export const Modalidad = z.enum(['domicilio', 'local', 'remoto'])
export const Dia = z.enum(['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'])
export const Franja = z.enum(['manana', 'tarde', 'noche'])
export const MedioDePago = z.enum(['efectivo', 'nequi', 'daviplata', 'bre_b'])

export const OficioDeProveedor = z.object({
  oficio_id: z.string(),
  nombre: z.string(),
  grupo: z.string().nullable(),
  modo: Modo,
  precio_desde: z.number().nullable(),
  unidad: Unidad.nullable(),
})

export const ResenaPublica = z.object({
  id: z.uuid(),
  cumplimiento: z.number().nullable(),
  trato: z.number().nullable(),
  puntualidad: z.number().nullable(),
  comentario: z.string().nullable(),
  replica: z.string().nullable(),
  creada_at: z.string(),
})

export const Ficha = z.object({
  id: z.uuid(),
  nombre_visible: z.string(),
  tipo: z.string(),
  telefono: z.string().nullable(),
  telefono_verificado: z.boolean(),
  municipio: z.string(),
  municipio_nombre: z.string().nullable(),
  municipio_departamento: z.string().nullable(),
  zona_nombre: z.string().nullable(),
  zona_texto: z.string().nullable(),
  modalidad: z.array(Modalidad),
  dias: z.array(Dia),
  franjas: z.array(Franja),
  medios_pago: z.array(MedioDePago),
  descripcion: z.string().nullable(),
  creado_at: z.string(),
  // Las tres señales blandas de la regla de producto 6. La ficha las muestra
  // siempre, incluso en cero: un perfil sin nada verificado tiene que verse
  // como lo que es.
  referencias_confirmadas: z.number(),
  servicios_confirmados: z.number(),
  total_resenas: z.number(),
  cumplimiento: z.number().nullable(),
  trato: z.number().nullable(),
  puntualidad: z.number().nullable(),
  oficios: z.array(OficioDeProveedor),
  resenas: z.array(ResenaPublica),
})

export type Ficha = z.infer<typeof Ficha>
export type OficioDeProveedor = z.infer<typeof OficioDeProveedor>
export type ResenaPublica = z.infer<typeof ResenaPublica>

export const EnListado = z.object({
  id: z.uuid(),
  nombre_visible: z.string(),
  tipo: z.string(),
  telefono_verificado: z.boolean(),
  municipio: z.string(),
  // El nombre resuelto, no solo el código. Antes la pantalla se traía los
  // 1.100 municipios del país para hacer el cruce en memoria.
  municipio_nombre: z.string().nullable(),
  zona_nombre: z.string().nullable(),
  zona_texto: z.string().nullable(),
  modalidad: z.array(Modalidad),
  referencias_confirmadas: z.number(),
  servicios_confirmados: z.number(),
  total_resenas: z.number(),
  cumplimiento: z.number().nullable(),
  descripcion: z.string().nullable(),
  // Los oficios de ESTE prestador, con su precio. Vienen dentro y no en una
  // consulta aparte por tarjeta.
  oficios: z.array(OficioDeProveedor),
})

export type EnListado = z.infer<typeof EnListado>

/**
 * Los filtros del directorio. Viven en la URL, así que el enlace se comparte.
 *
 * Cada uno lleva `.catch(undefined)`: un filtro mal formado se DESCARTA en
 * vez de rechazar la petición. Un filtro no es una frontera de seguridad, y
 * alguien que edita la URL a mano —o un enlace de WhatsApp que llegó
 * cortado— tiene que ver el directorio completo, no una pantalla de error.
 * Lo que sí sigue siendo estricto es todo lo demás: un `id` inválido en la
 * ficha sí es un 400, porque ahí no hay nada razonable que enseñar.
 */
export const Filtros = z.object({
  oficio: z.string().optional().catch(undefined),
  // Cinco dígitos, código DANE. Se valida aquí y no en la pantalla: la
  // aplicación de Expo no va a repetir la expresión regular.
  municipio: z
    .string()
    .regex(/^[0-9]{5}$/)
    .optional()
    .catch(undefined),
  zona: z.uuid().optional().catch(undefined),
  modalidad: Modalidad.optional().catch(undefined),
  modo: Modo.optional().catch(undefined),
})

export type Filtros = z.infer<typeof Filtros>

/** Lo que llena los desplegables y los chips. Solo lo que tiene gente detrás. */
export const Facetas = z.object({
  oficios: z.array(
    z.object({ id: z.string(), nombre: z.string(), grupo: z.string().nullable() }),
  ),
  municipios: z.array(
    z.object({
      codigo_dane: z.string(),
      nombre: z.string(),
      departamento: z.string().nullable(),
    }),
  ),
  // Solo se ofrecen cuando ya hay municipio: un desplegable con las comunas
  // de Cali mezcladas con los barrios de otra ciudad no significa nada.
  zonas: z.array(z.object({ id: z.uuid(), nombre: z.string() })),
})

export type Facetas = z.infer<typeof Facetas>

export const MiFicha = z.object({
  id: z.uuid(),
  suspendido: z.boolean(),
  oficios_escondidos: z.number(),
})

export type MiFicha = z.infer<typeof MiFicha>

export const contratoServicios = {
  /** La ficha pública de un prestador. Pantalla 09. */
  ficha: oc.input(z.object({ id: z.uuid() })).output(Ficha.nullable()),

  /**
   * El directorio con sus facetas. Pantallas 05, 06 y 07.
   *
   * Va todo en una llamada a propósito. Antes eran siete consultas sueltas
   * desde la pantalla —las fichas, sus oficios, el catálogo, los municipios,
   * las zonas—, y cada una era algo que la aplicación de Expo habría tenido
   * que acordarse de repetir en el mismo orden.
   *
   * El filtrado va aquí y no en la interfaz: la regla de producto 7 —los
   * oficios de riesgo alto no aparecen sin teléfono verificado y una
   * referencia confirmada— la sostiene la consulta. Una lista que se filtrara
   * en el cliente tendría que traerse antes las filas que no debe enseñar.
   */
  directorio: oc
    .input(Filtros)
    .output(z.object({ filas: z.array(EnListado), facetas: Facetas })),

  /**
   * La ficha propia de quien está en sesión, o null.
   *
   * Es lo que convierte «Ofrecer mi trabajo» en «Mi ficha»: sin esto, quien
   * ya publicó no tiene por dónde volver y el botón le sigue ofreciendo crear
   * una que ya existe.
   */
  miFicha: oc.output(MiFicha.nullable()),
}
