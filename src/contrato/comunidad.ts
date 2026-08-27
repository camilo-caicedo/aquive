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
  /** El punto de entrega elegido, si lo hay. */
  acopio_nombre: z.string().nullable(),
  acopio_direccion: z.string().nullable(),
  /**
   * Por dónde se le responde a quien ofrece.
   *
   * Nulos los tres en la cara que PIDE —esa persona no dio un solo dato— y
   * también en la que ofrece si no tiene ficha de prestador: su
   * autorización del muro cubre el nombre, no el contacto.
   */
  proveedor_id: z.uuid().nullable(),
  telefono: z.string().nullable(),
  telefono_verificado: z.boolean(),
})

export type EnMuro = z.infer<typeof EnMuro>

export const UNIDADES_PRODUCTO = [
  'unidad',
  'libra',
  'kilo',
  'docena',
  'plato',
  'trabajo',
] as const

export const UnidadProducto = z.enum(UNIDADES_PRODUCTO)

export type UnidadProducto = z.infer<typeof UnidadProducto>

/** Cómo se lee cada unidad al lado de un precio: «desde $3.500 la unidad». */
export const NOMBRE_UNIDAD: Record<(typeof UNIDADES_PRODUCTO)[number], string> = {
  unidad: 'la unidad',
  libra: 'la libra',
  kilo: 'el kilo',
  docena: 'la docena',
  plato: 'el plato',
  trabajo: 'el trabajo',
}

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
  /**
   * El mismo de su ficha, no uno nuevo: sale de `proveedores_publicos`,
   * que es donde vive el consentimiento. Sin él no hay manera de comprarle
   * a nadie, y la lista sería un escaparate sin puerta.
   */
  telefono: z.string().nullable(),
  telefono_verificado: z.boolean(),
  /** Familias de oficio de quien vende. Para acotar la lista. */
  grupos: z.array(z.string()),
  creado_at: z.string(),
})

export type Producto = z.infer<typeof Producto>

/**
 * Un producto visto por su dueño.
 *
 * Lleva `disponible`, que la lista pública no necesita —solo enseña lo
 * disponible— pero su dueño sí: es el interruptor de «hoy no hay».
 */
export const MiProducto = z.object({
  id: z.uuid(),
  nombre: z.string(),
  detalle: z.string().nullable(),
  modo: z.enum(['gratis', 'aporte', 'solidario', 'normal']),
  precio_desde: z.number().nullable(),
  unidad: UnidadProducto.nullable(),
  disponible: z.boolean(),
  creado_at: z.string(),
})

export type MiProducto = z.infer<typeof MiProducto>

const errores = {
  RECHAZADO: {
    status: 400,
    message: 'No se pudo guardar.',
    data: z.object({ motivo: z.string() }),
  },
} as const

/**
 * Una publicación del muro, propia.
 *
 * ⚠ Esto no existía, y con ello no existía forma de ver ni de borrar lo que
 * uno publicó: `publicaciones_muro` solo se INSERTABA. La interfaz prometía
 * lo contrario en tres sitios —«puedes borrarlas cuando quieras», «la vas a
 * encontrar en tu perfil»— y la regla de producto 3 dice que vive «mientras
 * su dueño la deje». Su dueño no tenía cómo dejarla.
 */
export const MiPublicacionMuro = z.object({
  id: z.uuid(),
  cara: Cara,
  categoria: z.string(),
  titulo: z.string(),
  detalle: z.string().nullable(),
  municipio: z.string(),
  municipio_nombre: z.string().nullable(),
  zona_nombre: z.string().nullable(),
  creada_at: z.string(),
  /** Nulo en la cara que ofrece: no caduca sola. */
  expira_at: z.string().nullable(),
  /** URL de su foto, o nulo. Sale aunque esté sin aprobar: es su dueña. */
  imagen: z.string().nullable(),
  estado_imagen: z.enum(['en_cola', 'aprobada', 'rechazada']).nullable(),
  /** El motivo, cuando se rechazó. Regla de producto 8, paso 5. */
  motivo_imagen: z.string().nullable(),
})

export type MiPublicacionMuro = z.infer<typeof MiPublicacionMuro>

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
   * NECESITA no publica su nombre. Las dos son cuentas (ADR 0006).
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
        /**
         * Dónde se entrega, si se elige un centro de acopio (ADR 0008).
         *
         * Sirve para no tener que dar la propia dirección: se deja ahí y
         * quien lo necesita lo recoge ahí. Es coherente con todo lo demás —
         * esta aplicación no publica dónde vive nadie.
         */
        acopio_id: z.uuid().optional(),
        /** Solo para la cara que ofrece: acepta que su nombre sea público. */
        acepto_publicar_nombre: z.boolean().default(false),
      }),
    )
    .output(z.object({ id: z.uuid() })),

  /** Lo que yo publiqué en el muro, de lo más nuevo a lo más viejo. */
  misPublicaciones: oc.output(z.array(MiPublicacionMuro)),

  /**
   * Borrado de verdad, con su foto (regla de producto 3).
   *
   * Nunca `estado = 'resuelta'`: la fila se va. En la cara que ofrece lleva
   * el nombre de esa persona y la versión de la autorización que firmó, así
   * que dejarla marcada sería seguir publicando lo que pidió retirar.
   */
  borrarPublicacion: oc
    .errors(errores)
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ ok: z.literal(true) })),

  /** Hecho en el barrio. Pantalla 31. */
  productos: oc
    .input(
      z.object({
        municipio: z.string().regex(/^[0-9]{5}$/).optional().catch(undefined),
        busqueda: z.string().trim().max(60).optional().catch(undefined),
        /** Familia de oficio de quien vende: comida, belleza, aseo… */
        grupo: z.string().trim().max(40).optional().catch(undefined),
        /** Cómo lo cobra. «Gratis» y «solidario» es lo que busca quien no tiene. */
        modo: z.enum(['gratis', 'aporte', 'solidario', 'normal']).optional().catch(undefined),
        /** Lo que vende una persona, para su ficha. */
        proveedor: z.uuid().optional().catch(undefined),
        /** Para la tira del inicio, que no quiere sesenta. */
        limite: z.number().int().min(1).max(60).optional().catch(undefined),
      }),
    )
    .output(z.array(Producto)),

  /** Los míos, incluidos los que tengo apagados. */
  misProductos: oc.output(z.array(MiProducto)),

  /**
   * Poner algo a la venta.
   *
   * Hace falta ficha de prestador: es la que lleva el nombre, la que tiene
   * la autorización firmada con su fecha y por donde escribe quien lo
   * quiere. Lo comprueba el dominio, no la pantalla.
   */
  publicarProducto: oc
    .errors(errores)
    .input(
      z.object({
        nombre: z.string().trim().min(2).max(140),
        detalle: z.string().trim().max(300).optional(),
        modo: z.enum(['gratis', 'aporte', 'solidario', 'normal']),
        /** Sin decimales y con techo: es un precio de barrio, no una factura. */
        precio_desde: z.number().int().positive().max(99999999).optional(),
        unidad: UnidadProducto.optional(),
        imagen_id: z.uuid().optional(),
      }),
    )
    .output(z.object({ id: z.uuid() })),

  /** Corregir el precio, el nombre, el detalle o la foto. */
  editarProducto: oc
    .errors(errores)
    .input(
      z.object({
        id: z.uuid(),
        nombre: z.string().trim().min(2).max(140),
        detalle: z.string().trim().max(300).optional(),
        modo: z.enum(['gratis', 'aporte', 'solidario', 'normal']),
        precio_desde: z.number().int().positive().max(99999999).optional(),
        unidad: UnidadProducto.optional(),
        /** Solo si se cambió: la anterior se borra con su objeto. */
        imagen_id: z.uuid().optional(),
      }),
    )
    .output(z.object({ ok: z.literal(true) })),

  /** «Hoy no hay», sin tener que escribirlo otra vez mañana. */
  disponibilidadProducto: oc
    .errors(errores)
    .input(z.object({ id: z.uuid(), disponible: z.boolean() }))
    .output(z.object({ ok: z.literal(true) })),

  /** Borrado de verdad, con su foto (regla de producto 3). */
  borrarProducto: oc
    .errors(errores)
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ ok: z.literal(true) })),

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
        objeto_tipo: z.enum(['muro', 'producto', 'proveedor']),
        tipo: z.string(),
        bytes: z.number().int().positive().max(2 * 1024 * 1024),
      }),
    )
    .output(z.object({ imagen_id: z.uuid(), url: z.string(), ruta: z.string() })),

  /** La cola del admin: lo que nadie ha mirado, lo más viejo primero. */
  colaDeImagenes: oc.output(
    z.array(
      z.object({
        id: z.uuid(),
        objeto_tipo: z.enum(['muro', 'producto', 'proveedor']),
        objeto_id: z.uuid().nullable(),
        url: z.string(),
        ancho: z.number().nullable(),
        alto: z.number().nullable(),
        subida_at: z.string(),
      }),
    ),
  ),

  /**
   * Aprobar o rechazar una imagen.
   *
   * Rechazar BORRA el archivo, no lo marca. Guardar un archivo que se rechazó
   * por tener a un menor identificable sería lo contrario de haberlo
   * rechazado.
   */
  moderarImagen: oc
    .errors(errores)
    .input(
      z.object({
        imagen_id: z.uuid(),
        aprobar: z.boolean(),
        motivo: z.string().trim().max(200).optional(),
      }),
    )
    .output(z.object({ ok: z.literal(true) })),

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
