// Tipos generados a mano a partir de supabase/schema.sql.
// Si el esquema cambia, actualiza este archivo en el mismo commit.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Categoria =
  | 'alimentacion'
  | 'aseo'
  | 'salud'
  | 'abrigo'
  | 'cocina'
  | 'otros'
  | 'servicios'
  | 'mascotas'
// Gemelo del CHECK `perfiles_tipo_check`. Tres valores desde el ADR 0014:
// 'ofertador' se fue con el módulo de insumos.
//
// 'vecino' es la cuenta de cualquiera y no publica nada por sí misma.
// 'servidor' es profesional con matrícula, y por eso publica nombre y
// contacto en `servidores_publicos`. 'aliado' lleva un centro de acopio
// (ADR 0008) y aparece al unirse a una organización: no se elige.
export type TipoPerfil = 'vecino' | 'servidor' | 'aliado'
export type TipoOrganizacion =
  | 'fundacion'
  | 'corporacion'
  | 'entidad_publica'
  | 'junta'
  | 'otra'
export type RolMiembro = 'coordinador' | 'miembro'
// ⚠ Aquí vivían `TipoDocumento` y `TitularIdentidad`. Se van con
// `crear_identidad`, la última función que los usaba: no hay ninguna
// columna de documento en la base desde el ADR 0007, así que ese dato ya
// no se pide ni se guarda. La garantía del mínimo legal 1 es hoy más
// fuerte que el CHECK que la sostenía — no es que se acepten CC, CE, PEP
// y PPT: es que no se acepta ninguno.
export type EstadoMiembro = 'pendiente' | 'activo' | 'inactivo'
export type AccionMiembro =
  | 'aprobar'
  | 'rechazar'
  | 'sacar'
  | 'activar'
  | 'desactivar'
  | 'ascender'
  | 'degradar'
export type PermisoMiembro = 'puede_ver_identidad' | 'puede_moderar'
export type ContactoTipo = 'whatsapp' | 'telefono'
export type EntidadMatricula = 'COPNIA' | 'CPNAA' | 'COLPSIC' | 'ReTHUS' | 'SIRNA' | 'OTRA'
export type AreaServicio = 'ingenieria' | 'arquitectura' | 'psicologia' | 'salud' | 'derecho'
// 'en_coordinacion' y 'entregada_parcial' entran con la Fase F. Todavia
// no los escribe nadie —los ponen G y H—, pero el predicado que los cubre
// (estado_activo) ya esta en las cuatro consultas que filtraban 'abierta'.
export type EstadoSolicitud =
  | 'abierta'
  | 'en_coordinacion'
  | 'entregada_parcial'
  | 'cumplida'
export type FlujoSolicitud = 'directo' | 'acompanado'
export type OrigenItem = 'semilla' | 'admin' | 'aliado' | 'sugerencia'
// Gemelo del CHECK de `sugerencias_item.origen`. El cuarto valor lleva ahí
// desde siempre y faltaba aquí; con el ADR 0013 se empezó a usar.
export type OrigenSugerencia = 'solicitante' | 'ofertador' | 'aliado' | 'proveedor'
export type EstadoSugerencia = 'pendiente' | 'aprobada' | 'rechazada' | 'fusionada'
export type AccionSugerencia = 'aprobar' | 'rechazar' | 'fusionar'
export type TipoObjetoReporte =
  | 'solicitud'
  | 'respuesta'
  | 'perfil'
  | 'entidad'
  | 'proveedor'
  | 'resena'
// Nacional cubre lo virtual: un servicio en línea no está atado a ningún
// municipio. El filtro por municipio devuelve las locales de ese municipio
// y todas las nacionales.
export type CoberturaEntidad = 'nacional' | 'local'
export type MotivoReporte =
  | 'datos_personales'
  | 'estafa'
  | 'contenido_ofensivo'
  | 'informacion_falsa'
  | 'menor_de_edad'
  // Los dos del módulo de Servicios. Son los riesgos que el documento
  // fuente nombra en su §7 y que no caben en «otro»: una reseña usada
  // como amenaza y el sesgo racial o de género se moderan distinto.
  | 'extorsion_resena'
  | 'discriminacion'
  | 'otro'

// ---------------------------------------------------------------------
// Módulo de Servicios (PLAN-V3)
// ---------------------------------------------------------------------

export type TipoProveedor = 'persona' | 'microempresa'
export type GrupoOficio =
  | 'comida'
  | 'belleza'
  | 'confeccion'
  | 'transporte'
  | 'aseo'
  | 'cuidado'
  | 'reparacion'
  | 'otros'
  // ADR 0012. Gemelo de `GrupoOficio` en `@/contrato/servicios` y de los
  // dos `CHECK` de Postgres.
  | 'construccion'
  | 'ensenanza'
  | 'eventos'
  | 'digital'
/** `alto` = si quien lo presta es un mal actor, el daño no es económico. */
export type RiesgoOficio = 'bajo' | 'alto'
export type ModoPrecio = 'gratis' | 'aporte' | 'solidario' | 'normal'
export type UnidadPrecio =
  | 'hora'
  | 'trabajo'
  | 'dia'
  | 'prenda'
  | 'viaje'
  | 'plato'
  | 'unidad'
export type ModalidadServicio = 'domicilio' | 'local' | 'remoto'
export type DiaSemana = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom'
export type FranjaHoraria = 'manana' | 'tarde' | 'noche'
/** Gemela de `medios_pago_validos()` en Postgres: si cambia una, la otra. */
export type MedioPago = 'efectivo' | 'nequi' | 'daviplata' | 'bre_b'
export type TipoZona = 'comuna' | 'corregimiento' | 'barrio'
/**
 * Lo sembrado nace `aprobada`. Lo que escribe alguien al publicar entra
 * como `propuesta` y no sale en ningún desplegable hasta que se revise.
 */
export type EstadoZona = 'propuesta' | 'aprobada' | 'rechazada'
export type UrgenciaServicio = 'hoy' | 'esta_semana' | 'sin_prisa'
export type CapacidadPago = 'puedo_pagar' | 'pago_poco' | 'no_puedo_pagar'
export type EstadoReferencia = 'pendiente' | 'confirmada' | 'no_contesta' | 'rechazada'

/**
 * Un oficio dentro del jsonb que recibe `guardar_proveedor`.
 *
 * `type` y no `interface`: un alias de tipo tiene firma de índice
 * implícita y una interfaz no, así que solo el alias es asignable a
 * `Json`. Mismo motivo por el que `OfrecimientoInput` también es alias.
 */
export type OficioProveedorInput = {
  oficio_id: string
  modo: ModoPrecio
  precio_desde?: number | null
  unidad?: UnidadPrecio | null
}

/** Lo que devuelve `ficha_proveedor`. Sale de la vista, no de la tabla. */
/**
 * Lo que devuelve `mi_proveedor`. Ve lo que la vista pública esconde: si
 * está suspendida y qué oficios todavía no se publican por la regla S.
 */
export interface MiProveedor {
  id: string
  nombre_visible: string
  tipo: TipoProveedor
  telefono: string
  telefono_verificado: boolean
  municipio: string
  zona_id: string | null
  zona_texto: string | null
  modalidad: ModalidadServicio[]
  dias: DiaSemana[]
  franjas: FranjaHoraria[]
  medios_pago: MedioPago[]
  descripcion: string | null
  suspendido: boolean
  alta_asistida: boolean
  sin_cuenta: boolean
  creado_at: string
  /** Lo que ESA persona aceptó y cuándo, no la versión de hoy (v4-e1). */
  autorizacion_version: string | null
  autorizacion_at: string | null
  acepto_mapa: boolean
  mapa_version: string | null
  mapa_at: string | null
  /** La foto lleva su propia casilla: publicar una cara es otra finalidad
   *  que publicar un teléfono (v6-b7, mismo criterio que el ADR 0004). */
  acepto_foto: boolean
  foto_version: string | null
  foto_at: string | null
  /** La dirección lleva la suya, aparte de la del mapa y la de publicar
   *  la ficha: publicar dónde vive o atiende alguien es otra finalidad
   *  (ADR 0017, mismo criterio que el ADR 0004). Se guarda siempre que se
   *  escriba, autorizada o no — es la vista pública la que filtra. */
  direccion: string | null
  acepto_direccion: boolean
  direccion_version: string | null
  direccion_at: string | null
  /** La ruta del objeto, no la URL. Sale aunque esté en cola o sin permiso:
   *  aquí se la enseñamos a su dueña, para que pueda quitarla. */
  foto: string | null
  foto_estado: 'en_cola' | 'aprobada' | 'rechazada' | null
  oficios: {
    oficio_id: string
    nombre: string
    grupo: GrupoOficio
    riesgo: RiesgoOficio
    modo: ModoPrecio
    precio_desde: number | null
    unidad: UnidadPrecio | null
    /** Falso cuando la regla S lo está escondiendo. */
    publicado: boolean
  }[]
  referencias_confirmadas: number
  servicios_confirmados: number
}

// Forma del ítem dentro del jsonb p_items que recibe crear_solicitud. Es
// uno de los dos, nunca los dos: el CHECK de solicitud_items lo impone.
export type ItemSolicitudInput =
  | { item_id: string; cantidad: number }
  | { sugerencia: string; cantidad: number }

// Ítem resumido tal como lo devuelve el jsonb `items` de solicitudes_publicas.
//
// `unidad` sigue siendo `string` y no `string | null` porque la vista hace
// `coalesce(c.unidad, sg.unidad_sugerida, 'unidad')`: un ítem sugerido no
// tiene fila en el catálogo, pero nunca llega sin unidad. Es lo que evita
// que `describirItem()` escriba "3 null de Crema dental" en el tablero.
export interface ItemResumen {
  nombre: string
  cantidad: number
  unidad: string
  // El ítem no está en el catálogo: alguien lo escribió y falta que un
  // administrador lo apruebe.
  por_confirmar: boolean
}

// Una fila de `solicitudes_que_calzan`. Es la del tablero más
// `coincidencias`: en cuántas de las cosas marcadas calza esta solicitud.
// No trae `item_ids` porque a esa altura ya no hace falta comparar nada.
export interface SolicitudQueCalza {
  id: string
  codigo: string
  municipio: string
  municipio_nombre: string
  barrio: string
  categoria: Categoria
  nota: string | null
  creada_at: string
  confirmada_at: string
  expira_at: string
  horas_sin_confirmar: number
  num_respuestas: number
  items: ItemResumen[]
  coincidencias: number
}

// Un ítem del inventario de quien ofrece, visto desde una solicitud
// concreta. Es `ItemOfrecido` más `calza`: si esta solicitud lo pide o
// no. Sigue sin cantidad, por lo mismo que la ficha pública.
export interface ItemOfrecidoCruce {
  nombre: string
  por_confirmar: boolean
  calza: boolean
}

// Los contadores del índice de administración, tal como los devuelve
// `panel_admin_indice`. Todos en una consulta: el índice dibuja diez
// filas con su número, y encadenar diez consultas para eso sería peor que
// las pestañas que reemplaza.
export interface IndiceAdmin {
  /** Imágenes esperando a que alguien las mire. Regla de producto 8. */
  imagenes: number
  /** PQR abiertas. Detrás de cada una hay un plazo legal corriendo. */
  pqr: number
  matriculas: number
  telefonos: number
  reportes: number
  solicitudes_servicio_sin_revisar: number
  sugerencias: number
  items_activos: number
  entidades: number
  entidades_retiradas: number
  resenas_ocultas: number
  zonas_pendientes: number
  fichas_suspendidas: number
  organizaciones: number
  organizaciones_inactivas: number
}

// Un reporte con lo reportado dentro, de `reportes_con_contenido`.
//
// ⚠ Sin nada de quién lo escribió. Se modera un texto; suspender una
// cuenta es otra acción y tiene su propia pantalla.
export interface ReporteConContenido {
  id: string
  motivo: MotivoReporte
  tipo_objeto: TipoObjetoReporte
  objeto_id: string
  /** Lo que escribió quien reportó. */
  nota: string | null
  creado_at: string
  /** Si el objeto sigue existiendo. Si no, solo se puede descartar. */
  existe: boolean
  /** El texto que se denunció. Nulo si ese objeto no tiene ninguno. */
  contenido: string | null
  /** El nombre de lo reportado, cuando tiene uno. */
  titulo: string | null
  contexto: { codigo: string; lugar: string } | null
  /** Los ítems, solo para una solicitud: la PII también se cuela ahí. */
  items: string[] | null
}

// Una fila de la bitácora unificada (`bitacora_accesos`).
//
// ⚠ Dice quién leyó, cuándo y con qué motivo. NUNCA qué leyó: aquí no hay
// ni un nombre, ni un documento, ni un teléfono. `lector` viene ya
// recortado a ocho caracteres desde la base.
export interface AccesoBitacora {
  tipo: 'identidad' | 'referencia'
  rol: 'admin' | 'aliado'
  lector: string
  /** La organización del lector, si es un aliado. */
  organizacion: string | null
  motivo: string
  cuando: string
  /** El dato que registra ya se borró; el rastro se queda. */
  huerfano: boolean
}

// Un municipio con solicitudes que calzan, tal como lo devuelve
// `municipios_que_calzan`.
export interface MunicipioQueCalza {
  codigo_dane: string
  nombre: string
  total: number
}

// Un botón de una ficha del directorio. La URL se muestra completa debajo
// del botón, y la valida `esEnlaceSeguro` en los dos lados.
export interface EnlaceEntidad {
  etiqueta: string
  url: string
}

// Las columnas que el panel necesita de `entidades`. Existe por lo mismo
// que `COLUMNAS_ITEM_PUBLICO`: un `select('*')` sobre esta tabla arrastra
// `creada_por`, que es el uuid de `auth.users` de una persona real.
export const COLUMNAS_ENTIDAD_ADMIN =
  'id, nombre, subtitulo, descripcion, enlaces, pie, cobertura, municipios, orden, activa'

// Una invitación viva, tal como la devuelven `organizaciones_admin` y
// `mi_aliado`. El `codigo` viaja en claro a propósito —hay que poder
// reimprimir el QR— pero nunca en una query string: va en el path de
// /unirse/[slug] o en el cuerpo de la RPC (regla 6).
export interface InvitacionResumen {
  id: string
  codigo: string
  rol_otorgado: RolMiembro
  expira_at: string
  usos: number
  usos_max: number
}

// Una fila de `organizaciones_admin()`. Sin `creada_por`: es el uuid de
// `auth.users` de una persona real, y por eso la lectura va por RPC y no
// por un `select` sobre la tabla.
export interface OrganizacionAdmin {
  id: string
  nombre: string
  tipo: TipoOrganizacion
  nit: string
  slug: string
  municipios: string[]
  direccion_acopio: string | null
  horario_acopio: string | null
  activa: boolean
  coordinadores: number
  miembros: number
  pendientes: number
  invitaciones: InvitacionResumen[]
}

// Una persona del equipo, tal como la ve un coordinador. Solo llega si
// quien pregunta es coordinador activo: un miembro raso no ve la lista.
export interface MiembroEquipo {
  perfil_id: string
  nombre_visible: string
  rol: RolMiembro
  estado: EstadoMiembro
  puede_ver_identidad: boolean
  puede_moderar: boolean
  creado_at: string
}

// Lo que devuelve `mi_aliado()`: una entrada por cada organización a la
// que pertenezco. `equipo` e `invitaciones` llegan vacíos si no soy
// coordinador activo — el filtro está en SQL, no en la pantalla.
export interface AliadoResumen {
  organizacion: {
    id: string
    nombre: string
    slug: string
    municipios: string[]
    direccion_acopio: string | null
    horario_acopio: string | null
    activa: boolean
  }
  yo: {
    rol: RolMiembro
    estado: EstadoMiembro
    puede_ver_identidad: boolean
    puede_moderar: boolean
  }
  equipo: MiembroEquipo[]
  invitaciones: InvitacionResumen[]
}

// Los seis estados de un hilo. `asignada` existe por la regla L: sin él,
// un hilo con organización pero sin persona a cargo quedaría «abierto» y
// sería bilateral de hecho, que es justo lo prohibido.
export type EstadoConversacion =
  | 'esperando_aliado'
  | 'asignada'
  | 'abierta'
  | 'acordada'
  | 'entregada'
  | 'cerrada'
export type RolEnConversacion = 'solicitante' | 'ofertador' | 'aliado' | 'admin'

// Una fila de `mis_avisos()`. No hay tabla de notificaciones: los tipos se
// derivan de datos que ya existen, y lo «nuevo» es todo lo posterior a
// `perfiles.avisos_vistos_at`.
//
// ⚠ Eran cinco tipos y la función solo emite dos. Los otros tres —`mensaje`,
// `invitacion`, `sin_atender`— eran del flujo acompañado, y `v5-b1` reescribió
// `mis_avisos()` sin ellos. El desajuste no era cosmético: el mapa de iconos
// de la campana se indexaba por este tipo, así que el único aviso que la base
// sí emite daba `undefined` y `<Icono />` reventaba la campana entera.
export interface Aviso {
  tipo: 'respuesta' | 'reporte'
  texto: string
  fecha: string
  /** A dónde lleva. Cada aviso es un enlace, no un resumen que toca buscar. */
  href: string
}

export interface EstadoEncabezado {
  /** `'organizacion'`, `'coordinacion'` o null. Ver `Navegacion`. */
  coordinacion: 'organizacion' | 'coordinacion' | null
  avisos_sin_ver: number
}


// Lo que devuelve `unirse_a_organizacion`.
export interface ResultadoUnirse {
  organizacion: string
  slug: string
  estado: EstadoMiembro
  rol: RolMiembro
}

// Un ítem tal como se ve en el directorio público de quien ofrece. Sin
// cantidad a propósito: ver §2 de la migración v2-a7.
export interface ItemOfrecido {
  nombre: string
  por_confirmar: boolean
}

// Lo único del catálogo que necesitan las pantallas de publicar y de
// registro. Existe para no hacer `select('*')`: la tabla es de lectura
// pública y desde la Fase A tiene `creado_por`, que es el uuid de
// `auth.users` de quien aprobó el ítem. Un `select('*')` lo serializaba
// hacia el navegador en una página anónima (CLAUDE.md regla 6).
export interface ItemCatalogoPublico {
  id: string
  categoria: Categoria
  nombre: string
  unidad: string
}

export const COLUMNAS_ITEM_PUBLICO = 'id, categoria, nombre, unidad'

// Una fila del jsonb que devuelve `sugerencias_pendientes`. `parecidos`
// son los ítems del catálogo que comparten alguna palabra con el nombre
// propuesto: están ahí para que fusionar cueste lo mismo que aprobar.
export interface SugerenciaPendiente {
  id: string
  /**
   * De qué catálogo es. `item` es de insumos, `oficio` es una
   * subcategoría de servicios (ADR 0013). La columna y su CHECK existían
   * desde antes y no los usaba nadie.
   */
  tipo: 'item' | 'oficio'
  nombre_propuesto: string
  /** Solo con `tipo: 'item'`. Las ocho categorías de insumos. */
  categoria_sugerida: Categoria | null
  /** Solo con `tipo: 'oficio'`. Las doce del ADR 0012. */
  grupo_sugerido: string | null
  origen: OrigenSugerencia
  creada_at: string
  usos: number
  /**
   * Lo parecido que ya existe, del catálogo que le toca. Es la decisión
   * real —«¿esto ya está con otro nombre?»— y por eso va primero.
   */
  parecidos: Array<{ id: string; nombre: string; categoria: string }>
}

export interface Database {
  public: {
    Tables: {
      catalogo_items: {
        Row: {
          id: string
          categoria: Categoria
          nombre: string
          unidad: string
          activo: boolean
          orden: number
          creado_por: string | null
          origen: OrigenItem
          es_prueba: boolean
        }
        Insert: {
          id: string
          categoria: Categoria
          nombre: string
          unidad?: string
          activo?: boolean
          orden?: number
          creado_por?: string | null
          origen?: OrigenItem
          es_prueba?: boolean
        }
        Update: Partial<Database['public']['Tables']['catalogo_items']['Insert']>
        Relationships: []
      }
      catalogo_servicios: {
        Row: {
          id: string
          area: AreaServicio
          nombre: string
          activo: boolean
          orden: number
        }
        Insert: {
          id: string
          area: AreaServicio
          nombre: string
          activo?: boolean
          orden?: number
        }
        Update: Partial<Database['public']['Tables']['catalogo_servicios']['Insert']>
        Relationships: []
      }
      catalogo_oficios: {
        Row: {
          id: string
          grupo: GrupoOficio
          nombre: string
          riesgo: RiesgoOficio
          activo: boolean
          orden: number
        }
        Insert: {
          id: string
          grupo: GrupoOficio
          nombre: string
          riesgo?: RiesgoOficio
          activo?: boolean
          orden?: number
        }
        Update: Partial<Database['public']['Tables']['catalogo_oficios']['Insert']>
        Relationships: []
      }
      zonas: {
        Row: {
          id: string
          municipio: string
          nombre: string
          tipo: TipoZona
          activa: boolean
          orden: number
          /**
           * Solo lo `aprobada` sale en los desplegables: la política de
           * RLS lo filtra, así que una consulta desde el cliente nunca ve
           * lo propuesto.
           */
          estado: EstadoZona
        }
        Insert: {
          id?: string
          municipio: string
          nombre: string
          tipo: TipoZona
          activa?: boolean
          orden?: number
        }
        Update: Partial<Database['public']['Tables']['zonas']['Insert']>
        Relationships: []
      }
      municipios: {
        Row: {
          codigo_dane: string
          nombre: string
          departamento: string
          afectado: boolean
        }
        Insert: {
          codigo_dane: string
          nombre: string
          departamento: string
          afectado?: boolean
        }
        Update: Partial<Database['public']['Tables']['municipios']['Insert']>
        Relationships: []
      }
      perfiles: {
        Row: {
          id: string
          nombre_visible: string
          tipo: TipoPerfil
          municipios: string[]
          // NULL solo para un aliado: a un aliado no se le publica ficha,
          // así que no tiene contacto público que mostrar.
          contacto_publico: string | null
          contacto_tipo: ContactoTipo
          descripcion: string | null
          acepto_publicacion: boolean
          acepto_politica_at: string
          suspendido: boolean
          creado_at: string
          /** Puede desplazarse a entregar. En positivo: false no dice que no pueda. */
          puede_trasladarse: boolean
        }
        Insert: {
          id: string
          nombre_visible: string
          tipo: TipoPerfil
          municipios?: string[]
          contacto_publico?: string | null
          contacto_tipo?: ContactoTipo
          descripcion?: string | null
          acepto_publicacion?: boolean
          acepto_politica_at?: string
          suspendido?: boolean
          creado_at?: string
        }
        Update: Partial<Database['public']['Tables']['perfiles']['Insert']>
        Relationships: []
      }
      servidores: {
        Row: {
          perfil_id: string
          profesion: string
          // v6-f3: opcionales desde que la matrícula salió del registro
          // (ADR de la tarea del 3 de septiembre de 2026). NULL significa
          // "todavía no la dio", no "no tiene" — se llena después desde
          // /perfil/matricula.
          entidad_matricula: EntidadMatricula | null
          numero_matricula: string | null
          verificado: boolean
          verificado_at: string | null
          verificado_por: string | null
          servicios: string[]
        }
        Insert: {
          perfil_id: string
          profesion: string
          entidad_matricula?: EntidadMatricula | null
          numero_matricula?: string | null
          verificado?: boolean
          verificado_at?: string | null
          verificado_por?: string | null
          servicios?: string[]
        }
        Update: Partial<Database['public']['Tables']['servidores']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'servidores_perfil_id_fkey'
            columns: ['perfil_id']
            isOneToOne: true
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
        ]
      }
      administradores: {
        Row: {
          user_id: string
          creado_at: string
        }
        Insert: {
          user_id: string
          creado_at?: string
        }
        Update: Partial<Database['public']['Tables']['administradores']['Insert']>
        Relationships: []
      }
      // El cliente nunca la lee directamente: el GRANT está revocado y lo
      // público sale de `entidades_publicas`. El panel la lee con
      // `COLUMNAS_ENTIDAD_ADMIN`, jamás con `select('*')`.
      entidades: {
        Row: {
          id: string
          nombre: string
          subtitulo: string | null
          descripcion: string | null
          enlaces: EnlaceEntidad[]
          pie: string | null
          cobertura: CoberturaEntidad
          municipios: string[]
          orden: number
          activa: boolean
          creada_por: string | null
          creada_at: string
          actualizada_at: string
          es_prueba: boolean
        }
        Insert: {
          id?: string
          nombre: string
          subtitulo?: string | null
          descripcion?: string | null
          enlaces?: EnlaceEntidad[]
          pie?: string | null
          cobertura?: CoberturaEntidad
          municipios?: string[]
          orden?: number
          activa?: boolean
          creada_por?: string | null
          creada_at?: string
          actualizada_at?: string
          es_prueba?: boolean
        }
        Update: Partial<Database['public']['Tables']['entidades']['Insert']>
        Relationships: []
      }
      // Las tres tablas del Flujo 2 están revocadas enteras para `anon` y
      // `authenticated`: el cliente no las lee ni las escribe nunca, todo
      // pasa por las RPC. Se tipan por lo mismo que `solicitudes`, para
      // que el archivo siga siendo el espejo de schema.sql.
      organizaciones: {
        Row: {
          id: string
          nombre: string
          tipo: TipoOrganizacion
          nit: string
          slug: string
          municipios: string[]
          direccion_acopio: string | null
          horario_acopio: string | null
          activa: boolean
          creada_por: string | null
          creada_at: string
          actualizada_at: string
          es_prueba: boolean
        }
        Insert: {
          id?: string
          nombre: string
          tipo?: TipoOrganizacion
          nit: string
          slug: string
          municipios: string[]
          direccion_acopio?: string | null
          horario_acopio?: string | null
          activa?: boolean
          creada_por?: string | null
          creada_at?: string
          actualizada_at?: string
          es_prueba?: boolean
        }
        Update: Partial<Database['public']['Tables']['organizaciones']['Insert']>
        Relationships: []
      }
      invitaciones_organizacion: {
        Row: {
          id: string
          organizacion_id: string
          codigo: string
          rol_otorgado: RolMiembro
          creada_por: string | null
          expira_at: string
          usos_max: number
          usos: number
          activa: boolean
          creada_at: string
        }
        Insert: {
          id?: string
          organizacion_id: string
          codigo: string
          rol_otorgado?: RolMiembro
          creada_por?: string | null
          expira_at: string
          usos_max?: number
          usos?: number
          activa?: boolean
          creada_at?: string
        }
        Update: Partial<Database['public']['Tables']['invitaciones_organizacion']['Insert']>
        Relationships: []
      }
      miembros_organizacion: {
        Row: {
          organizacion_id: string
          perfil_id: string
          rol: RolMiembro
          estado: EstadoMiembro
          puede_ver_identidad: boolean
          puede_moderar: boolean
          invitacion_id: string | null
          creado_at: string
          aprobado_por: string | null
          aprobado_at: string | null
          permiso_identidad_por: string | null
          permiso_identidad_at: string | null
        }
        Insert: {
          organizacion_id: string
          perfil_id: string
          rol?: RolMiembro
          estado?: EstadoMiembro
          // No lleva `puede_ver_identidad`: un trigger BEFORE INSERT
          // rechaza la fila si llega en true. Solo se concede después,
          // con `otorgar_permiso_miembro`.
          puede_moderar?: boolean
          invitacion_id?: string | null
          creado_at?: string
          aprobado_por?: string | null
          aprobado_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['miembros_organizacion']['Insert']>
        Relationships: []
      }
      sugerencias_item: {
        Row: {
          id: string
          nombre_propuesto: string
          categoria_sugerida: Categoria | null
          unidad_sugerida: string | null
          propuesta_por: string | null
          origen: OrigenSugerencia
          estado: EstadoSugerencia
          item_resultante_id: string | null
          revisada_por: string | null
          revisada_at: string | null
          nota_revision: string | null
          creada_at: string
          es_prueba: boolean
        }
        Insert: {
          id?: string
          nombre_propuesto: string
          categoria_sugerida?: Categoria | null
          unidad_sugerida?: string | null
          propuesta_por?: string | null
          origen: OrigenSugerencia
          estado?: EstadoSugerencia
          item_resultante_id?: string | null
          revisada_por?: string | null
          revisada_at?: string | null
          nota_revision?: string | null
          creada_at?: string
          es_prueba?: boolean
        }
        Update: Partial<Database['public']['Tables']['sugerencias_item']['Insert']>
        Relationships: []
      }
      push_ofertadores: {
        Row: {
          id: string
          perfil_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          creada_at: string
        }
        Insert: {
          id?: string
          perfil_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          creada_at?: string
        }
        Update: Partial<Database['public']['Tables']['push_ofertadores']['Insert']>
        Relationships: []
      }
      reportes: {
        Row: {
          id: string
          tipo_objeto: TipoObjetoReporte
          objeto_id: string
          motivo: MotivoReporte
          nota: string | null
          atendido: boolean
          creado_at: string
        }
        Insert: {
          id?: string
          tipo_objeto: TipoObjetoReporte
          objeto_id: string
          motivo: MotivoReporte
          nota?: string | null
          atendido?: boolean
          creado_at?: string
        }
        Update: Partial<Database['public']['Tables']['reportes']['Insert']>
        Relationships: []
      }
    }
    Views: {
      municipios_con_servidores: {
        Row: { codigo_dane: string; nombre: string; departamento: string }
        Relationships: []
      }
      // Solo los de las entidades locales: las nacionales están en todos y
      // no aportan nada al desplegable.
      municipios_con_entidades: {
        Row: { codigo_dane: string; nombre: string; departamento: string }
        Relationships: []
      }
      // Sin `creada_por` ni `es_prueba`: la vista ES la frontera, igual que
      // en `solicitudes_publicas`.
      entidades_publicas: {
        Row: {
          id: string
          nombre: string
          subtitulo: string | null
          descripcion: string | null
          enlaces: EnlaceEntidad[]
          pie: string | null
          cobertura: CoberturaEntidad
          municipios: string[]
          orden: number
        }
        Relationships: []
      }
      servidores_publicos: {
        Row: {
          id: string
          nombre_visible: string
          municipios: string[]
          contacto_publico: string
          contacto_tipo: ContactoTipo
          descripcion: string | null
          profesion: string
          entidad_matricula: EntidadMatricula
          numero_matricula: string
          verificado: boolean
          servicios: string[]
        }
        Relationships: []
      }
      // Módulo de Servicios. `proveedores_publicos` ya trae aplicada la
      // regla S: los oficios de riesgo alto de quien no está verificado
      // no salen, y quien se queda sin ningún oficio publicable no sale
      // en absoluto.
      proveedores_publicos: {
        Row: {
          id: string
          nombre_visible: string
          tipo: TipoProveedor
          telefono: string
          telefono_verificado: boolean
          municipio: string
          zona_id: string | null
          zona_nombre: string | null
          zona_texto: string | null
          modalidad: ModalidadServicio[]
          dias: DiaSemana[]
          franjas: FranjaHoraria[]
          medios_pago: MedioPago[]
          descripcion: string | null
          creado_at: string
          oficios: string[]
          grupos: GrupoOficio[]
          referencias_confirmadas: number
          servicios_confirmados: number
          cumplimiento: number | null
          trato: number | null
          puntualidad: number | null
          total_resenas: number
          /** Modos de precio de sus oficios PUBLICADOS, para el filtro. */
          modos: ModoPrecio[]
        }
        Relationships: []
      }
      proveedor_oficios_publicos: {
        Row: {
          proveedor_id: string
          oficio_id: string
          modo: ModoPrecio
          precio_desde: number | null
          unidad: UnidadPrecio | null
          oficio_nombre: string
          grupo: GrupoOficio
          riesgo: RiesgoOficio
        }
        Relationships: []
      }
      resenas_publicas: {
        Row: {
          id: string
          proveedor_id: string
          cumplimiento: number
          trato: number
          puntualidad: number
          comentario: string | null
          replica: string | null
          replica_at: string | null
          creada_at: string
        }
        Relationships: []
      }
      solicitudes_servicio_publicas: {
        Row: {
          id: string
          codigo: string
          oficio_id: string
          oficio_nombre: string
          grupo: GrupoOficio
          municipio: string
          zona_id: string | null
          zona_nombre: string | null
          zona_texto: string | null
          urgencia: UrgenciaServicio
          capacidad_pago: CapacidadPago
          nota: string | null
          creada_at: string
          expira_at: string
          num_respuestas: number
        }
        Relationships: []
      }
      municipios_con_proveedores: {
        Row: { codigo_dane: string; nombre: string; departamento: string }
        Relationships: []
      }
      datos_servicios: {
        Row: {
          municipio: string
          grupo: GrupoOficio
          oficio: string
          solicitudes: number
          con_respuesta: number
          resueltas: number
          horas_promedio: number | null
        }
        Relationships: []
      }
      oficios_con_proveedores: {
        Row: { id: string; nombre: string; grupo: GrupoOficio; orden: number }
        Relationships: []
      }
    }
    Functions: {
      guardar_push: {
        Args: { p_endpoint: string; p_p256dh: string; p_auth: string }
        Returns: undefined
      }
      quitar_push: {
        Args: { p_endpoint?: string | null }
        Returns: undefined
      }
      // Los contadores del índice de /admin, en una sola llamada.
      panel_admin_indice: {
        Args: Record<string, never>
        Returns: Json
      }
      // La cola de reportes CON lo reportado: decidir entre descartar y
      // borrar para siempre sin ver el contenido es firmar a ciegas.
      reportes_con_contenido: {
        Args: Record<string, never>
        Returns: Json
      }
      // La bitácora de las dos tablas de accesos, en una sola lista.
      bitacora_accesos: {
        Args: Record<string, never>
        Returns: Json
      }
      // Devuelve cada sugerencia pendiente con los ítems parecidos del
      // catálogo, para que fusionar cueste lo mismo que aprobar.
      sugerencias_pendientes: {
        Args: Record<string, never>
        Returns: Json
      }
      // ⚠ `p_riesgo` no tiene valor por defecto en la base y aquí tampoco
      // se le pone uno: es obligatorio al aprobar un oficio, porque la
      // regla de producto 7 cuelga de esa columna (ADR 0013).
      resolver_sugerencia: {
        Args: {
          p_sugerencia_id: string
          p_accion: AccionSugerencia
          p_item_destino?: string | null
          p_nota?: string | null
          /** El texto ya corregido por quien modera. */
          p_nombre_final?: string | null
          /** Solo para oficios: su categoría de las doce. */
          p_grupo?: string | null
          /** Solo para oficios, y solo al aprobar. */
          p_riesgo?: 'bajo' | 'alto' | null
        }
        Returns: string | null
      }
      // `p_id` null crea, con valor actualiza. Una sola función porque el
      // formulario del panel es el mismo en los dos casos.
      guardar_entidad: {
        Args: {
          p_id: string | null
          p_nombre: string
          p_subtitulo?: string | null
          p_descripcion?: string | null
          p_enlaces?: Json
          p_pie?: string | null
          p_cobertura?: CoberturaEntidad
          p_municipios?: string[]
          p_orden?: number
        }
        Returns: string
      }
      activar_entidad: {
        Args: { p_id: string; p_activa: boolean }
        Returns: undefined
      }
      borrar_entidad: {
        Args: { p_id: string }
        Returns: undefined
      }
      // Organizaciones aliadas (Fase D). Las crea un administrador; nadie
      // se auto-registra. `p_id` null crea, con valor actualiza.
      guardar_organizacion: {
        Args: {
          p_id: string | null
          p_nombre: string
          p_nit: string
          p_slug: string
          p_municipios: string[]
          p_tipo?: TipoOrganizacion
          p_direccion_acopio?: string | null
          p_horario_acopio?: string | null
        }
        Returns: string
      }
      activar_organizacion: {
        Args: { p_id: string; p_activa: boolean }
        Returns: undefined
      }
      // Devuelve OrganizacionAdmin[]. Va por RPC y no por `select` para
      // que `creada_por` no llegue nunca al navegador.
      organizaciones_admin: {
        Args: Record<string, never>
        Returns: Json
      }
      // Devuelve InvitacionResumen más el `slug`, que es lo que hace falta
      // para armar el enlace y el QR. Un administrador solo puede generar
      // la de coordinador; el resto del equipo lo arma la organización.
      crear_invitacion: {
        Args: {
          p_organizacion_id: string
          p_rol?: RolMiembro
          p_horas?: number
          p_usos_max?: number
        }
        Returns: Json
      }
      desactivar_invitacion: {
        Args: { p_id: string }
        Returns: undefined
      }
      // Lo único que se puede saber de una organización sin estar dentro:
      // su nombre. Es la única de este bloque con EXECUTE para `anon`.
      organizacion_por_slug: {
        Args: { p_slug: string }
        Returns: Json
      }
      // Devuelve ResultadoUnirse. Sin código válido se entra a la cola de
      // pendientes, nunca con un error.
      unirse_a_organizacion: {
        Args: { p_slug: string; p_nombre_visible: string; p_codigo?: string | null }
        Returns: Json
      }
      // Devuelve AliadoResumen[].
      mi_aliado: {
        Args: Record<string, never>
        Returns: Json
      }
      gestionar_miembro: {
        Args: { p_organizacion_id: string; p_perfil_id: string; p_accion: AccionMiembro }
        Returns: undefined
      }
      // Aparte de `gestionar_miembro` a propósito: `puede_ver_identidad`
      // es lo que deja ver cédulas y no puede viajar como un valor más
      // dentro de un menú de acciones.
      otorgar_permiso_miembro: {
        Args: {
          p_organizacion_id: string
          p_perfil_id: string
          p_permiso: PermisoMiembro
          p_valor: boolean
        }
        Returns: undefined
      }
      // Devuelve EstadoEncabezado. Todo lo que el encabezado necesita
      // saber en una sola consulta: si se dibuja la pestaña de /aliado y
      // con qué nombre, y cuántos avisos hay sin ver. Como `soy_aliado`,
      // no autoriza nada — cada RPC vuelve a comprobar quién es quién.
      estado_encabezado: {
        Args: Record<string, never>
        Returns: Json
      }
      // Devuelve Aviso[]. Se pide al abrir el panel, no en cada carga: en
      // el encabezado solo viaja el número.
      mis_avisos: {
        Args: Record<string, never>
        Returns: Json
      }
      marcar_avisos_vistos: {
        Args: Record<string, never>
        Returns: undefined
      }
      soy_aliado: {
        Args: Record<string, never>
        Returns: boolean
      }
      crear_item_catalogo: {
        Args: { p_nombre: string; p_categoria: Categoria; p_unidad?: string }
        Returns: string
      }
      mi_proveedor: {
        Args: { p_token?: string | null }
        Returns: Json
      }
      guardar_proveedor: {
        Args: {
          p_nombre_visible: string
          p_tipo: TipoProveedor
          p_telefono: string
          p_municipio: string
          p_zona_id: string | null
          p_zona_texto: string | null
          p_modalidad: ModalidadServicio[]
          p_dias: DiaSemana[]
          p_franjas: FranjaHoraria[]
          p_medios_pago: MedioPago[]
          p_descripcion: string | null
          p_oficios: Json
          p_acepto_publicacion: boolean
          p_autorizacion_version: string
          // v6-f3 (ADR 0017): la dirección, opcional, con su propia
          // autorización aparte.
          p_direccion?: string | null
          p_acepto_direccion?: boolean
          p_direccion_version?: string | null
          p_token?: string | null
        }
        Returns: string
      }
      guardar_matricula: {
        Args: {
          p_entidad_matricula: EntidadMatricula
          p_numero_matricula: string
        }
        Returns: undefined
      }
      mi_organizacion_activa: {
        Args: Record<string, never>
        Returns: string | null
      }
      proveedores_de_mi_organizacion: {
        Args: Record<string, never>
        Returns: Json
      }
      verificar_telefono_proveedor: {
        Args: { p_proveedor_id: string; p_verificado: boolean }
        Returns: undefined
      }
      suspender_proveedor: {
        Args: { p_proveedor_id: string; p_suspendido: boolean }
        Returns: undefined
      }
      crear_referencia: {
        Args: {
          p_nombre: string
          p_telefono: string
          p_oficio_id: string | null
          p_consentimiento_version: string
          p_token?: string | null
        }
        Returns: string
      }
      mis_referencias: {
        Args: { p_token?: string | null }
        Returns: Json
      }
      borrar_referencia: {
        Args: { p_id: string; p_token?: string | null }
        Returns: undefined
      }
      // Descifra. Escribe `accesos_referencia` antes de devolver.
      leer_referencia: {
        Args: { p_id: string; p_motivo: string }
        Returns: Json
      }
      marcar_referencia: {
        Args: { p_id: string; p_estado: EstadoReferencia }
        Returns: undefined
      }
      referencias_por_revisar: {
        Args: Record<string, never>
        Returns: Json
      }
      responder_servicio: {
        Args: { p_solicitud_id: string; p_mensaje: string; p_token?: string | null }
        Returns: undefined
      }
      solicitudes_de_servicio: {
        Args: {
          p_municipio?: string | null
          p_oficio_id?: string | null
          p_token?: string | null
        }
        Returns: Json
      }
      // Devuelve el código EN CLARO, una sola vez.
      crear_codigo_servicio: {
        Args: { p_oficio_id?: string | null; p_token?: string | null }
        Returns: string
      }
      mis_servicios: {
        Args: { p_token?: string | null }
        Returns: Json
      }
      responder_resena: {
        Args: { p_resena_id: string; p_replica: string; p_token?: string | null }
        Returns: undefined
      }
      // Sin grant a `anon`: la llama /api/servicios/confirmar tras el
      // Turnstile. El código es inadivinable, pero nada impide intentarlo
      // un millón de veces desde un script.
      confirmar_y_resenar: {
        Args: {
          p_codigo: string
          p_cumplimiento: number
          p_trato: number
          p_puntualidad: number
          p_comentario?: string | null
        }
        Returns: Json
      }
      ocultar_resena: {
        Args: { p_resena_id: string; p_oculta: boolean }
        Returns: undefined
      }
      borrar_resena: {
        Args: { p_resena_id: string }
        Returns: undefined
      }
      panel_admin_servicios: {
        Args: Record<string, never>
        Returns: Json
      }
      zonas_propuestas: {
        Args: Record<string, never>
        Returns: Json
      }
      resolver_zona: {
        Args: {
          p_id: string
          p_aprobar: boolean
          p_nombre?: string | null
          p_tipo?: TipoZona | null
        }
        Returns: undefined
      }
      guardar_zona: {
        Args: {
          p_municipio: string
          p_nombre: string
          p_tipo: TipoZona
          p_orden?: number
        }
        Returns: string
      }
      guardar_oficio: {
        Args: {
          p_id: string
          p_grupo: GrupoOficio
          p_nombre: string
          p_riesgo: RiesgoOficio
          p_activo?: boolean
          p_orden?: number
        }
        Returns: undefined
      }
      verificar_servidor: {
        Args: { p_perfil_id: string; p_verificado: boolean }
        Returns: undefined
      }
      suspender_perfil: {
        Args: { p_perfil_id: string; p_suspendido: boolean }
        Returns: undefined
      }
      resolver_reporte: {
        Args: { p_reporte_id: string; p_borrar: boolean }
        Returns: undefined
      }
      // Devuelve un único jsonb con TODOS los municipios. Una consulta
      // normal se cortaría en 1000 filas y perderíamos 122.
      listar_municipios: {
        Args: Record<string, never>
        Returns: Json
      }
      es_admin: {
        Args: { uid: string }
        Returns: boolean
      }
    }
  }
}
