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
// 'aliado' no se elige en /registro: aparece al unirse a una organización.
// Un aliado no tiene ficha pública ni contacto publicado.
export type TipoPerfil = 'ofertador' | 'servidor' | 'aliado'
export type TipoOrganizacion =
  | 'fundacion'
  | 'corporacion'
  | 'entidad_publica'
  | 'junta'
  | 'otra'
export type RolMiembro = 'coordinador' | 'miembro'
// Regla O: sin datos de menores. TI y RC no están, y no es un olvido —
// un CHECK de la base los rechaza aunque alguien los escriba a mano.
export type TipoDocumento = 'CC' | 'CE' | 'PEP' | 'PPT'
export type TitularIdentidad = 'solicitante' | 'ofertador' | 'aliado'
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
export type OrigenSugerencia = 'solicitante' | 'ofertador' | 'aliado'
export type EstadoSugerencia = 'pendiente' | 'aprobada' | 'rechazada' | 'fusionada'
export type AccionSugerencia = 'aprobar' | 'rechazar' | 'fusionar'
export type TipoObjetoReporte = 'solicitud' | 'respuesta' | 'perfil' | 'entidad'
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
  | 'otro'

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

// Lo que devuelve `leer_identidad`. Cada vez que este objeto existe, hay
// una fila nueva en `accesos_identidad` diciendo quién lo pidió y por qué
// (regla N). No lo pases a un Client Component ni lo metas en un log.
export interface IdentidadDescifrada {
  id: string
  titular_tipo: TitularIdentidad
  nombre: string
  documento_tipo: TipoDocumento
  documento: string
  telefono: string | null
  autorizacion_version: string
  autorizacion_at: string
}

// Lo que devuelve `buscar_identidad_presencial`. NO descifra nada: son los
// cuatro últimos dígitos —que quien busca acaba de teclear— y el código de
// la solicitud, que es lo que hace falta para seguir.
export interface CoincidenciaIdentidad {
  id: string
  titular_tipo: TitularIdentidad
  documento_ultimos4: string
  solicitud_codigo: string | null
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

// Una fila del jsonb que devuelve `mis_ofrecimientos`. `nombre` y `unidad`
// vienen resueltos: da igual si el ítem salió del catálogo o de una
// sugerencia sin aprobar todavía.
export interface OfrecimientoResumen {
  item_id: string | null
  sugerencia_id: string | null
  nombre: string
  categoria: Categoria | null
  unidad: string
  cantidad: number | null
  disponible: boolean
  por_confirmar: boolean
}

// Lo que recibe `guardar_ofrecimientos`. Exactamente una de las tres
// llaves identifica el ítem; el CHECK de la tabla lo impone.
export type OfrecimientoInput = { cantidad?: number | null; disponible?: boolean } & (
  | { item_id: string }
  | { sugerencia_id: string }
  | { sugerencia: string }
)

// Una fila del jsonb que devuelve `sugerencias_pendientes`. `parecidos`
// son los ítems del catálogo que comparten alguna palabra con el nombre
// propuesto: están ahí para que fusionar cueste lo mismo que aprobar.
export interface SugerenciaPendiente {
  id: string
  nombre_propuesto: string
  categoria_sugerida: Categoria | null
  origen: OrigenSugerencia
  creada_at: string
  usos: number
  parecidos: Array<{ id: string; nombre: string; categoria: Categoria }>
}

// Forma del jsonb que devuelve leer_solicitud
export interface SolicitudConRespuestas {
  id: string
  codigo: string
  municipio: string
  barrio: string
  categoria: Categoria
  nota: string | null
  estado: EstadoSolicitud
  expira_at: string
  flujo: FlujoSolicitud
  /** Nombre de la fundacion que acompaña, o null en Flujo 1. Nunca su id. */
  organizacion: string | null
  items: Array<ItemResumen & { cubierto: boolean }>
  respuestas: Array<{
    id: string
    mensaje: string
    creada_at: string
    nombre: string
    contacto: string
    contacto_tipo: ContactoTipo
    tipo: TipoPerfil
    profesion: string | null
    verificado: boolean
  }>
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
          entidad_matricula: EntidadMatricula
          numero_matricula: string
          verificado: boolean
          verificado_at: string | null
          verificado_por: string | null
          servicios: string[]
        }
        Insert: {
          perfil_id: string
          profesion: string
          entidad_matricula: EntidadMatricula
          numero_matricula: string
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
      // El cliente nunca lee ni escribe esta tabla directamente (RLS la revoca).
      // Toda escritura pasa por las RPC de más abajo. Se tipa para uso server-side.
      solicitudes: {
        Row: {
          id: string
          codigo: string
          token_hash: string
          municipio: string
          barrio: string
          categoria: Categoria
          nota: string | null
          estado: EstadoSolicitud
          creada_at: string
          confirmada_at: string
          expira_at: string
          // Temporal, mientras dure el periodo de pruebas. La deriva
          // `crear_solicitud` del prefijo del barrio.
          es_prueba: boolean
        }
        Insert: {
          id?: string
          codigo: string
          token_hash: string
          municipio: string
          barrio: string
          categoria: Categoria
          nota?: string | null
          estado?: EstadoSolicitud
          creada_at?: string
          confirmada_at?: string
          expira_at?: string
          es_prueba?: boolean
        }
        Update: Partial<Database['public']['Tables']['solicitudes']['Insert']>
        Relationships: []
      }
      // Exactamente uno de `item_id` y `sugerencia_id` está puesto: lo
      // impone el CHECK `solicitud_items_uno_u_otro`.
      solicitud_items: {
        Row: {
          id: string
          solicitud_id: string
          item_id: string | null
          sugerencia_id: string | null
          cantidad: number
          cubierto: boolean
        }
        Insert: {
          id?: string
          solicitud_id: string
          item_id?: string | null
          sugerencia_id?: string | null
          cantidad: number
          cubierto?: boolean
        }
        Update: Partial<Database['public']['Tables']['solicitud_items']['Insert']>
        Relationships: []
      }
      // El cliente nunca la lee ni la escribe directamente: el GRANT está
      // revocado y la frontera son `guardar_ofrecimientos` y
      // `mis_ofrecimientos`. Se tipa para uso del lado del servidor.
      ofrecimientos: {
        Row: {
          id: string
          perfil_id: string
          item_id: string | null
          sugerencia_id: string | null
          cantidad: number | null
          disponible: boolean
          actualizado_at: string
        }
        Insert: {
          id?: string
          perfil_id: string
          item_id?: string | null
          sugerencia_id?: string | null
          cantidad?: number | null
          disponible?: boolean
          actualizado_at?: string
        }
        Update: Partial<Database['public']['Tables']['ofrecimientos']['Insert']>
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
      respuestas: {
        Row: {
          id: string
          solicitud_id: string
          autor_id: string
          mensaje: string
          creada_at: string
        }
        Insert: {
          id?: string
          solicitud_id: string
          autor_id: string
          mensaje: string
          creada_at?: string
        }
        Update: Partial<Database['public']['Tables']['respuestas']['Insert']>
        Relationships: []
      }
      push_suscripciones: {
        Row: {
          id: string
          solicitud_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          creada_at: string
        }
        Insert: {
          id?: string
          solicitud_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          creada_at?: string
        }
        Update: Partial<Database['public']['Tables']['push_suscripciones']['Insert']>
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
      metricas: {
        Row: {
          id: number
          municipio: string
          categoria: Categoria
          cumplida: boolean
          horas_hasta_respuesta: number | null
          horas_hasta_cierre: number | null
          num_respuestas: number
          registrada_at: string
          // De qué flujo venía. Sin esto, la única pregunta interesante que
          // se puede responder después —si acompañar sirvió de algo— queda
          // sin respuesta, y metricas es lo que sobrevive al proyecto.
          flujo: FlujoSolicitud
          // Esta tabla no tiene FK: sin esta columna, las filas que dejan
          // las solicitudes de prueba no se pueden identificar después.
          es_prueba: boolean
        }
        Insert: {
          id?: number
          municipio: string
          categoria: Categoria
          cumplida: boolean
          horas_hasta_respuesta?: number | null
          horas_hasta_cierre?: number | null
          num_respuestas?: number
          registrada_at?: string
          es_prueba?: boolean
        }
        Update: Partial<Database['public']['Tables']['metricas']['Insert']>
        Relationships: []
      }
    }
    Views: {
      solicitudes_publicas: {
        Row: {
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
          // Los identificadores, aparte del jsonb legible: el jsonb sirve
          // para mostrar, estos para cruzar. Sin ellos el modo "¿quién
          // necesita lo que tengo?" no se puede filtrar.
          item_ids: string[]
          sugerencia_ids: string[]
          // Solo si hay acompañamiento o no. De la organizacion y de la
          // identidad no sale NADA por esta vista, que la lee anon.
          flujo: FlujoSolicitud
        }
        Relationships: []
      }
      // Solo los municipios que de verdad tienen contenido. Existen para
      // no mandar los 1.122 del país en cada carga del tablero: con señal
      // mala eso pesaba más que todo el resto de la página junta.
      municipios_con_solicitudes: {
        Row: { codigo_dane: string; nombre: string; departamento: string }
        Relationships: []
      }
      municipios_con_servidores: {
        Row: { codigo_dane: string; nombre: string; departamento: string }
        Relationships: []
      }
      municipios_con_ofertadores: {
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
      // Sin `contacto_publico` a propósito: el contacto ocurre cuando el
      // ofertador responde una solicitud, no al revés.
      //
      // `items` trae los NOMBRES de lo que tiene disponible, nunca las
      // cantidades: una lista pública de quién tiene cuánto y dónde es un
      // mapa de existencias. Vienen hasta 12; `total_items` dice cuántos
      // hay en realidad.
      ofertadores_publicos: {
        Row: {
          id: string
          nombre_visible: string
          municipios: string[]
          descripcion: string | null
          creado_at: string
          items: ItemOfrecido[]
          total_items: number
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
    }
    Functions: {
      crear_solicitud: {
        Args: {
          p_municipio: string
          p_barrio: string
          p_categoria: Categoria
          p_nota: string | null
          p_items: Json
          p_token: string
        }
        Returns: { solicitud_id: string; codigo: string }[]
      }
      leer_solicitud: {
        Args: { p_token: string }
        Returns: Json
      }
      renovar_solicitud: {
        Args: { p_token: string }
        Returns: string
      }
      cerrar_solicitud: {
        Args: { p_token: string; p_cumplida: boolean }
        Returns: undefined
      }
      guardar_push: {
        Args: { p_token: string; p_endpoint: string; p_p256dh: string; p_auth: string }
        Returns: undefined
      }
      guardar_push_ofertador: {
        Args: { p_endpoint: string; p_p256dh: string; p_auth: string }
        Returns: undefined
      }
      quitar_push_ofertador: {
        Args: { p_endpoint?: string | null }
        Returns: undefined
      }
      guardar_ofrecimientos: {
        Args: { p_items: Json }
        Returns: undefined
      }
      // El cruce inverso. Filtra y ordena en SQL porque PostgREST puede
      // hacer el `&&` pero no ordenar por cuántos ítems coinciden, que es
      // la mitad del valor: quien pide cinco cosas que tengo vale más que
      // quien pide una.
      solicitudes_que_calzan: {
        Args: {
          p_item_ids: string[]
          p_municipio?: string | null
          p_limite?: number
          p_desde?: number
        }
        Returns: SolicitudQueCalza[]
      }
      municipios_que_calzan: {
        Args: { p_item_ids: string[] }
        Returns: Json
      }
      // Interna: solo la llama el route handler con la llave de servicio.
      // Resuelve en la base a quién avisar, porque traer los inventarios
      // para cruzarlos en TypeScript chocaba con el tope de 1000 filas de
      // PostgREST y metía uuid de personas en la URL de un GET.
      destinatarios_aviso: {
        Args: { p_municipio: string; p_item_ids: string[] }
        Returns: Array<{
          suscripcion_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          calza: boolean
        }>
      }
      // Devuelve cada sugerencia pendiente con los ítems parecidos del
      // catálogo, para que fusionar cueste lo mismo que aprobar.
      sugerencias_pendientes: {
        Args: Record<string, never>
        Returns: Json
      }
      resolver_sugerencia: {
        Args: {
          p_sugerencia_id: string
          p_accion: AccionSugerencia
          p_item_destino?: string | null
          p_nota?: string | null
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
      // Elección de flujo (Fase F). Devuelve {id, nombre} de UNA
      // organización activa que cubra ese municipio, o null. Es lo único
      // que se puede saber sin haber elegido nada todavía.
      aliado_en_municipio: {
        Args: { p_municipio: string }
        Returns: Json
      }
      // Crea la identidad cifrada y marca la solicitud, en una sola
      // transacción. Si falla, la solicitud se queda en 'directo', que es
      // el modo seguro de fallar. No hay camino de vuelta (§7).
      activar_acompanamiento: {
        Args: {
          p_token: string
          p_organizacion_id: string
          p_nombre: string
          p_documento_tipo: TipoDocumento
          p_documento: string
          p_autorizacion_version: string
          p_telefono?: string | null
        }
        Returns: Json
      }
      // Identidad cifrada (Fase E). `identidades` y `accesos_identidad` NO
      // están tipadas como tablas, y es deliberado: están revocadas enteras
      // y no hay ninguna lectura legítima que no pase por estas RPC, ni
      // siquiera del lado del servidor. Tiparlas sería una invitación a
      // hacer el `select` que no debe existir.
      //
      // Interna: la llama el servidor con la llave de servicio, como
      // `destinatarios_aviso`. No cifra en el cliente y no devuelve nada
      // descifrado.
      crear_identidad: {
        Args: {
          p_titular_tipo: TitularIdentidad
          p_nombre: string
          p_documento_tipo: TipoDocumento
          p_documento: string
          p_autorizacion_version: string
          p_telefono?: string | null
          p_solicitud_id?: string | null
          p_perfil_id?: string | null
        }
        Returns: string
      }
      // Devuelve IdentidadDescifrada y escribe bitácora ANTES de devolver.
      // Falla si el motivo viene vacío.
      leer_identidad: {
        Args: { p_id: string; p_motivo: string }
        Returns: Json
      }
      // Devuelve CoincidenciaIdentidad[]. Deja rastro incluso cuando no
      // encuentra nada: una búsqueda a ciegas también es un acceso.
      buscar_identidad_presencial: {
        Args: { p_documento: string; p_motivo: string }
        Returns: Json
      }
      crear_item_catalogo: {
        Args: { p_nombre: string; p_categoria: Categoria; p_unidad?: string }
        Returns: string
      }
      mis_ofrecimientos: {
        Args: Record<string, never>
        Returns: Json
      }
      crear_perfil: {
        Args: {
          p_nombre_visible: string
          p_tipo: TipoPerfil
          p_municipios: string[]
          p_contacto_publico: string
          p_contacto_tipo: ContactoTipo
          p_descripcion: string | null
          p_profesion?: string | null
          p_entidad_matricula?: EntidadMatricula | null
          p_numero_matricula?: string | null
          p_servicios?: string[]
        }
        Returns: undefined
      }
      responder_solicitud: {
        Args: { p_codigo: string; p_mensaje: string }
        Returns: string
      }
      crear_reporte: {
        Args: {
          p_tipo_objeto: TipoObjetoReporte
          p_objeto_id: string
          p_motivo: MotivoReporte
          p_nota?: string | null
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
      generar_codigo: {
        Args: Record<string, never>
        Returns: string
      }
      es_admin: {
        Args: { uid: string }
        Returns: boolean
      }
      expirar_solicitudes: {
        Args: Record<string, never>
        Returns: number
      }
    }
  }
}
