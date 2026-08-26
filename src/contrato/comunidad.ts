import { oc } from '@orpc/contract'
import { z } from 'zod'

// Comunidad: el muro y «Hecho en el barrio». ADR 0003, decisión 2.
//
// Las imágenes van aquí también, porque es donde se usan hoy. Si mañana las
// pide otro módulo, se sacan a su propio archivo.

export const Cara = z.enum(['ofrece', 'necesita'])
export type Cara = z.infer<typeof Cara>

export const CATEGORIAS_MURO = [
  'hogar',
  'ropa',
  'educacion',
  'alimentos',
  'aseo',
  'herramientas',
  'otros',
] as const

export const CategoriaMuro = z.enum(CATEGORIAS_MURO)

export const NOMBRE_CATEGORIA_MURO: Record<string, string> = {
  hogar: 'Hogar',
  ropa: 'Ropa',
  educacion: 'Educación',
  alimentos: 'Alimentos',
  aseo: 'Aseo',
  herramientas: 'Herramientas',
  otros: 'Otros',
}

export const EnMuro = z.object({
  id: z.uuid(),
  cara: Cara,
  categoria: z.string(),
  titulo: z.string(),
  detalle: z.string().nullable(),
  municipio: z.string(),
  municipio_nombre: z.string().nullable(),
  zona_nombre: z.string().nullable(),
  /** Solo la cara que ofrece tiene nombre. La otra no lo tiene ni en la tabla. */
  autor_nombre: z.string().nullable(),
  creada_at: z.string(),
  imagen: z.string().nullable(),
})

export type EnMuro = z.infer<typeof EnMuro>

export const UnidadProducto = z.enum([
  'unidad',
  'libra',
  'kilo',
  'docena',
  'plato',
  'trabajo',
])

export const Producto = z.object({
  id: z.uuid(),
  proveedor_id: z.uuid(),
  proveedor_nombre: z.string(),
  municipio: z.string(),
  zona_nombre: z.string().nullable(),
  nombre: z.string(),
  detalle: z.string().nullable(),
  modo: z.enum(['gratis', 'aporte', 'solidario', 'normal']),
  precio_desde: z.number().nullable(),
  unidad: UnidadProducto.nullable(),
  imagen: z.string().nullable(),
})

export type Producto = z.infer<typeof Producto>

const errores = {
  RECHAZADO: {
    status: 400,
    message: 'No se pudo guardar.',
    data: z.object({ motivo: z.string() }),
  },
} as const

export const contratoComunidad = {
  /** El muro, una cara a la vez. Pantalla 30. */
  muro: oc
    .input(
      z.object({
        cara: Cara.default('ofrece'),
        municipio: z.string().regex(/^[0-9]{5}$/).optional().catch(undefined),
        categoria: z.string().optional().catch(undefined),
      }),
    )
    .output(z.array(EnMuro)),

  /**
   * Publicar en el muro.
   *
   * La asimetría de la regla de producto 4 la sostiene la base con dos CHECK,
   * pero se declara también aquí para que el error llegue antes y en
   * castellano: quien OFRECE publica con nombre y consentimiento; quien
   * NECESITA no da un solo dato y recibe un token.
   */
  publicarEnMuro: oc
    .errors(errores)
    .input(
      z.object({
        cara: Cara,
        categoria: CategoriaMuro,
        titulo: z.string().trim().min(3).max(140),
        detalle: z.string().trim().max(300).optional(),
        municipio: z.string().regex(/^[0-9]{5}$/),
        zona_id: z.uuid().optional(),
        imagen_id: z.uuid().optional(),
        /** Solo para la cara que ofrece: acepta que su nombre sea público. */
        acepto_publicar_nombre: z.boolean().default(false),
      }),
    )
    .output(z.object({ id: z.uuid(), token: z.string().nullable() })),

  /** Hecho en el barrio. Pantalla 31. */
  productos: oc
    .input(
      z.object({
        municipio: z.string().regex(/^[0-9]{5}$/).optional().catch(undefined),
        busqueda: z.string().trim().max(60).optional().catch(undefined),
      }),
    )
    .output(z.array(Producto)),

  // --- Imágenes -------------------------------------------------------

  /**
   * Pedir permiso para subir una imagen.
   *
   * Devuelve una URL firmada contra el bucket de CUARENTENA, que no es
   * público. La imagen no se ve hasta que una persona la apruebe.
   */
  firmarImagen: oc
    .errors(errores)
    .input(
      z.object({
        objeto_tipo: z.enum(['muro', 'producto']),
        tipo: z.string(),
        bytes: z.number().int().positive().max(2 * 1024 * 1024),
      }),
    )
    .output(z.object({ imagen_id: z.uuid(), url: z.string(), ruta: z.string() })),

  /**
   * Avisar de que la subida terminó, para que el servidor la limpie.
   *
   * Aquí es donde se descarta el EXIF. No es opcional: una foto de teléfono
   * lleva las coordenadas GPS de dónde se tomó, y quien modera ve la imagen,
   * no sus metadatos.
   */
  procesarImagen: oc
    .errors(errores)
    .input(z.object({ imagen_id: z.uuid() }))
    .output(z.object({ ok: z.literal(true) })),
}
