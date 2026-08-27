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
  /**
   * URL de su foto, o nulo.
   *
   * Nulo también cuando la tiene subida pero retiró la autorización: eso lo
   * decide la vista `proveedores_publicos`, no esta consulta (ADR 0004,
   * mismo criterio que las coordenadas).
   */
  foto: z.string().nullable(),
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
  /** URL de su foto, o nulo si no la tiene o retiró la autorización. */
  foto: z.string().nullable(),
  // Salen NULL si el prestador no marcó `acepto_mapa`. El filtro vive en la
  // vista pública y no aquí: si se duplica, un día una copia se olvida, y
  // olvidarse significa publicar dónde encontrar a alguien que no lo
  // autorizó.
  latitud: z.number().nullable(),
  longitud: z.number().nullable(),
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
  // Una familia entera —«Comida», «Cuidado»— y no un oficio suelto. Es a lo
  // que lleva cada tarjeta de la pantalla de categorías.
  grupo: z.string().optional().catch(undefined),
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

/**
 * Los doce grupos de oficio, con su nombre legible.
 *
 * Vive en el contrato y no en `lib/servicios.ts` porque es dato compartido:
 * la aplicación de Expo va a pintar las mismas categorías y no tiene por qué
 * llevar una segunda copia de esta tabla que se desincronice.
 *
 * ⚠ Los cuatro últimos entran con el ADR 0012. Esta lista se repite en
 * cuatro sitios y no puede ser uno solo: aquí, en el union de
 * `src/lib/types.ts`, y en los dos `CHECK` de Postgres —el de
 * `catalogo_oficios` y el de `solicitudes_servicio`—. Los `CHECK` son la
 * garantía; estos dos son tipos, y un tipo no defiende una tabla. Si se
 * añade un grupo, se tocan los cuatro.
 */
export const GrupoOficio = z.enum([
  'comida',
  'belleza',
  'confeccion',
  'transporte',
  'aseo',
  'cuidado',
  'reparacion',
  'otros',
  'construccion',
  'ensenanza',
  'eventos',
  'digital',
])

export type GrupoOficio = z.infer<typeof GrupoOficio>

export const NOMBRE_GRUPO: Record<string, string> = {
  comida: 'Comida',
  belleza: 'Belleza',
  confeccion: 'Confección y arreglos',
  transporte: 'Transporte y trasteos',
  aseo: 'Aseo',
  cuidado: 'Cuidado',
  reparacion: 'Reparaciones',
  // «Arreglos de la casa» y no «Construcción»: lo que hay dentro es
  // pintura, enchape y goteras, y lo estructural sigue fuera por matrícula
  // (regla de producto 7). El nombre no debe prometer lo que el grupo no
  // tiene.
  construccion: 'Arreglos de la casa',
  ensenanza: 'Clases y refuerzo',
  eventos: 'Fiestas y eventos',
  digital: 'Computador y trámites',
  otros: 'Otros',
}

/** Un grupo de oficios con cuánta gente hay detrás. Pantalla 06. */
export const Categoria = z.object({
  grupo: z.string(),
  nombre: z.string(),
  cuantos: z.number(),
  // Tres oficios de ejemplo, para que «Hogar» signifique algo antes de
  // entrar. Salen de los que de verdad tienen gente, no de una lista fija:
  // enseñar «Plomería» donde no hay ningún plomero es una promesa falsa.
  ejemplos: z.array(z.string()),
})

export type Categoria = z.infer<typeof Categoria>

/** Una zona con cuánta gente trabaja ahí. Pantalla 08. */
export const ZonaConGente = z.object({
  id: z.uuid(),
  nombre: z.string(),
  municipio: z.string(),
  municipio_nombre: z.string().nullable(),
  cuantos: z.number(),
})

export type ZonaConGente = z.infer<typeof ZonaConGente>

/**
 * Los rechazos de ubicación, declarados y no improvisados.
 *
 * Misma lección que en el chat: sin esto, «no encontramos tu ficha» volvía
 * como 500 «Internal server error» y quien lo veía no sabía si el fallo era
 * suyo o nuestro. Un rechazo que no explica es un rechazo que genera un
 * mensaje de soporte.
 */
/**
 * Una solicitud de servicio propia.
 *
 * Sustituye a lo que antes vivía en `localStorage`: la lista de tokens de
 * este teléfono. Con cuenta (ADR 0006) lo suyo se le pregunta al servidor,
 * lo que además arregla que cambiar de teléfono fuera perderlo todo.
 */
export const MiSolicitudServicio = z.object({
  id: z.uuid(),
  /** Cuatro letras y dos dígitos: se dice por teléfono sin deletrear. */
  codigo: z.string(),
  /** Su categoría, de los ocho gajos. */
  grupo: GrupoOficio,
  /** Lo que pidió, con sus palabras (ADR 0011). */
  detalle: z.string(),
  estado: z.string(),
  creada_at: z.string(),
  expira_at: z.string(),
  /**
   * Cuántos respondieron.
   *
   * ⚠ Faltaba, y sin él quien pedía un servicio publicaba, veía un código y
   * no volvía a saber nada: ninguna pantalla le decía si alguien se había
   * movido. La vista SQL ya lo calculaba.
   */
  num_respuestas: z.number(),
})

export type MiSolicitudServicio = z.infer<typeof MiSolicitudServicio>

const erroresUbicacion = {
  RECHAZADO: {
    status: 400,
    message: 'No se pudo guardar tu ubicación.',
    data: z.object({ motivo: z.string() }),
  },
} as const

/** Un profesional con matrícula, para la tira de la portada. */
export const ProfesionalBreve = z.object({
  id: z.uuid(),
  nombre_visible: z.string(),
  profesion: z.string().nullable(),
  verificado: z.boolean(),
  municipios: z.array(z.string()),
})

/** Una entidad del directorio informativo. */
export const EntidadBreve = z.object({
  id: z.uuid(),
  nombre: z.string(),
  subtitulo: z.string().nullable(),
  cobertura: z.string(),
})

export type ProfesionalBreve = z.infer<typeof ProfesionalBreve>
export type EntidadBreve = z.infer<typeof EntidadBreve>

export const contratoServicios = {
  /**
   * Lo que llena la portada: quién está trabajando AHORA y cerca.
   *
   * «Ahora» es el día y la franja de este momento en America/Bogota, cruzados
   * con los que cada prestador declaró. En UTC el servidor cambiaría de día a
   * las 7 p. m. hora de Cali y la lista se vaciaría a media tarde.
   *
   * «Cerca» es el municipio y nada más fino. No hay ubicación del visitante y
   * no se le va a pedir: la distancia en kilómetros que dibuja el prototipo
   * necesitaría saber dónde está quien mira, y eso es un dato que esta
   * aplicación no recoge de quien busca.
   */
  inicio: oc
    .input(
      z.object({
        municipio: z.string().regex(/^[0-9]{5}$/).optional().catch(undefined),
      }),
    )
    .output(
      z.object({
        disponibles: z.array(EnListado),
        profesionales: z.array(ProfesionalBreve),
        entidades: z.array(EntidadBreve),
      }),
    ),

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

  /**
   * Guardar —o quitar— el punto propio del mapa. ADR 0004.
   *
   * Va como procedimiento APARTE de guardar la ficha, y no por comodidad: el
   * consentimiento de ubicación es un acto distinto del de publicar nombre y
   * teléfono (artículo 9, finalidad declarada). Un acto distinto merece una
   * llamada distinta, con su propia versión de autorización y su fecha.
   *
   * `acepto: false` quita del mapa sin tocar nada más de la ficha. Quitarse
   * tiene que ser tan fácil como ponerse, o el consentimiento no es libre.
   */
  /**
   * Pedir un servicio.
   *
   * ⚠ Exige cuenta desde el ADR 0006. Lo que se le PIDE a quien pide no
   * cambió: oficio, municipio, zona, urgencia, capacidad de pago y la nota
   * filtrada. Su nombre no se publica y la solicitud no lo lleva.
   */
  publicarSolicitud: oc
    .errors(erroresUbicacion)
    .input(
      z.object({
        // ADR 0011: la categoría es cerrada, el detalle lo escribe quien
        // pide. El catálogo de oficios sigue siendo cosa de la ficha de
        // quien ofrece, no de lo que otra persona puede necesitar.
        grupo: GrupoOficio,
        detalle: z.string().trim().min(3).max(80),
        municipio: z.string().regex(/^[0-9]{5}$/),
        zona_id: z.uuid().optional(),
        zona_texto: z.string().trim().max(80).optional(),
        urgencia: z.enum(['hoy', 'esta_semana', 'sin_prisa']),
        capacidad_pago: z.enum(['puedo_pagar', 'pago_poco', 'no_puedo_pagar']),
        nota: z.string().trim().max(140).optional(),
      }),
    )
    .output(z.object({ id: z.uuid(), codigo: z.string() })),

  /** Las mías, para el perfil. */
  misSolicitudes: oc.output(z.array(MiSolicitudServicio)),

  /**
   * Borrar mi ficha, con su foto y las de mis productos.
   *
   * ⚠ Va por el contrato y no por la RPC `borrar_proveedor`, que era un
   * `delete` a secas: una función de Postgres no puede borrar un objeto del
   * almacén, y la regla de producto 3 dice que borrar una fila borra también
   * sus imágenes. Con la RPC, la foto de la cara de esa persona se quedaba
   * publicada después de que ella pidiera borrarla.
   */
  borrarFicha: oc
    .errors(erroresUbicacion)
    .output(z.object({ ok: z.literal(true) })),

  /**
   * Alta asistida: alguien del equipo de un aliado registra a un prestador
   * que no tiene cuenta de Google.
   *
   * Crea una cuenta de verdad (ADR 0006) y devuelve su código de acceso EN
   * CLARO. Es la única vez que existe: se guarda solo su `sha256`, y se
   * canjea en `/entrar/<codigo>`.
   */
  altaAsistida: oc
    .errors(erroresUbicacion)
    .input(
      z.object({
        organizacion_id: z.uuid(),
        nombre_visible: z.string().trim().min(3).max(60),
        tipo: z.enum(['persona', 'microempresa']),
        telefono: z.string().trim().min(7).max(20),
        municipio: z.string().regex(/^[0-9]{5}$/),
        zona_id: z.uuid().optional(),
        zona_texto: z.string().trim().max(60).optional(),
        modalidad: z.array(z.enum(['domicilio', 'local', 'remoto'])).min(1),
        oficios: z
          .array(
            z.object({
              oficio_id: z.string().min(1).max(60),
              modo: z.enum(['gratis', 'aporte', 'solidario', 'normal']),
            }),
          )
          .min(1),
        autorizacion_version: z.string().trim().min(3).max(60),
      }),
    )
    .output(
      z.object({ proveedor_id: z.uuid(), perfil_id: z.uuid(), codigo: z.string() }),
    ),

  /**
   * La foto de mi ficha, con su autorización.
   *
   * `imagen_id` en nulo = quitarla. Quitarla borra el archivo del almacén,
   * no solo la marca: dejar la cara de alguien en una URL pública después
   * de que dijo que no sería lo contrario de haberlo dicho.
   */
  guardarFoto: oc
    .errors(erroresUbicacion)
    .input(
      z.object({
        imagen_id: z.uuid().nullable(),
        autorizacion_version: z.string().trim().min(3).max(60).nullable(),
      }),
    )
    .output(z.object({ ok: z.literal(true) })),

  /** Renovarla por otros 15 días, o cerrarla. */
  gestionarSolicitud: oc
    .errors(erroresUbicacion)
    .input(z.object({ id: z.uuid(), accion: z.enum(['renovar', 'cerrar']) }))
    .output(z.object({ ok: z.literal(true) })),

  /**
   * El punto propio, para poder editarlo.
   *
   * Se lee de la TABLA y no de `proveedores_publicos`: quien se quitó del
   * mapa tiene que poder ver su punto para volver a ponerlo, y la vista —con
   * razón— se lo esconde a todo el mundo, incluido su dueño.
   */
  miUbicacion: oc
    .input(z.void())
    .output(
      z
        .object({
          latitud: z.number().nullable(),
          longitud: z.number().nullable(),
          acepto: z.boolean(),
        })
        .nullable(),
    ),

  guardarUbicacion: oc
    .errors(erroresUbicacion)
    .input(
      z.object({
        // El token de quien fue dado de alta por la fundación y no tiene
        // cuenta. Buena parte del rebusque está en ese caso.
        acepto: z.boolean(),
        latitud: z.number().min(-4.5).max(13.5).nullable(),
        longitud: z.number().min(-82).max(-66).nullable(),
      }),
    )
    .output(z.object({ ok: z.literal(true) })),

  /**
   * Las categorías con cuánta gente hay en cada una. Pantalla 06.
   *
   * Solo los grupos que tienen a alguien: una rejilla de ocho tarjetas donde
   * cinco dicen «0 cerca» no es un catálogo, es una lista de lo que no
   * tenemos.
   */
  categorias: oc
    .input(z.object({ municipio: z.string().regex(/^[0-9]{5}$/).optional().catch(undefined) }))
    .output(z.array(Categoria)),

  /**
   * Las zonas con gente, agregadas. Pantalla 08.
   *
   * Devuelve CUÁNTOS por zona, nunca dónde está nadie. La granularidad
   * máxima del proyecto es barrio o comuna (regla de producto 10), y una
   * zona con su conteo es justo eso: dice que en Belén trabajan seis
   * personas, no dónde vive ninguna de las seis.
   */
  zonas: oc
    .input(z.object({ municipio: z.string().regex(/^[0-9]{5}$/).optional().catch(undefined) }))
    .output(z.array(ZonaConGente)),
}
