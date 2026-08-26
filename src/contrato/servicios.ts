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
  zona_nombre: z.string().nullable(),
  zona_texto: z.string().nullable(),
  modalidad: z.array(Modalidad),
  referencias_confirmadas: z.number(),
  servicios_confirmados: z.number(),
  total_resenas: z.number(),
  cumplimiento: z.number().nullable(),
})

export type EnListado = z.infer<typeof EnListado>

export const contratoServicios = {
  /** La ficha pública de un prestador. Pantalla 09. */
  ficha: oc
    .input(z.object({ id: z.uuid() }))
    .output(Ficha.nullable()),

  /**
   * El directorio. Pantallas 06 y 07.
   *
   * El filtro por oficio y municipio va aquí y no en la interfaz: la regla
   * de producto 7 —los oficios de riesgo alto no se publican sin teléfono
   * verificado y una referencia confirmada— la sostiene la consulta, y una
   * lista que se filtrara en el cliente tendría que traerse antes las filas
   * que precisamente no debe enseñar.
   */
  listado: oc
    .input(
      z.object({
        oficio: z.string().optional(),
        municipio: z.string().optional(),
        limite: z.number().int().min(1).max(50).default(20),
        desde: z.number().int().min(0).default(0),
      }),
    )
    .output(z.object({ filas: z.array(EnListado), hay_mas: z.boolean() })),
}
