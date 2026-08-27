import { pgTable, index, foreignKey, check, uuid, text, timestamp, boolean, uniqueIndex, numeric, pgPolicy, jsonb, integer, unique, bigserial, smallint, primaryKey, pgView, bigint } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { bytea, usersInAuth } from "../tipos";



export const mensajes = pgTable("mensajes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: uuid("chat_id").notNull(),
	autor: text().notNull(),
	cuerpo: text().notNull(),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	oculto: boolean().default(false).notNull(),
}, (table) => [
	index("idx_mensajes_chat_autor").using("btree", table.chatId.asc().nullsLast().op("timestamptz_ops"), table.autor.asc().nullsLast().op("uuid_ops"), table.creadoAt.desc().nullsFirst().op("uuid_ops")).where(sql`(NOT oculto)`),
	index("idx_mensajes_servicio_chat").using("btree", table.chatId.asc().nullsLast().op("uuid_ops"), table.creadoAt.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chats.id],
			name: "mensajes_chat_id_fkey"
		}).onDelete("cascade"),
	check("mensajes_autor_check", sql`autor = ANY (ARRAY['pide'::text, 'ofrece'::text])`),
	check("mensajes_cuerpo_check", sql`(char_length(cuerpo) >= 1) AND (char_length(cuerpo) <= 500)`),
]);

export const ofrecimientos = pgTable("ofrecimientos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	perfilId: uuid("perfil_id").notNull(),
	itemId: text("item_id"),
	sugerenciaId: uuid("sugerencia_id"),
	cantidad: numeric({ precision: 8, scale:  2 }),
	disponible: boolean().default(true).notNull(),
	actualizadoAt: timestamp("actualizado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_ofrecimientos_item").using("btree", table.itemId.asc().nullsLast().op("text_ops")).where(sql`disponible`),
	uniqueIndex("ofrecimientos_item_uniq").using("btree", table.perfilId.asc().nullsLast().op("text_ops"), table.itemId.asc().nullsLast().op("uuid_ops")).where(sql`(item_id IS NOT NULL)`),
	uniqueIndex("ofrecimientos_sug_uniq").using("btree", table.perfilId.asc().nullsLast().op("uuid_ops"), table.sugerenciaId.asc().nullsLast().op("uuid_ops")).where(sql`(sugerencia_id IS NOT NULL)`),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [catalogoItems.id],
			name: "ofrecimientos_item_id_fkey"
		}),
	foreignKey({
			columns: [table.perfilId],
			foreignColumns: [perfiles.id],
			name: "ofrecimientos_perfil_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sugerenciaId],
			foreignColumns: [sugerenciasItem.id],
			name: "ofrecimientos_sugerencia_id_fkey"
		}).onDelete("restrict"),
	check("ofrecimientos_cantidad_check", sql`(cantidad IS NULL) OR ((cantidad > (0)::numeric) AND (cantidad <= (9999)::numeric))`),
	check("ofrecimientos_uno_u_otro", sql`num_nonnulls(item_id, sugerencia_id) = 1`),
]);

export const entregas = pgTable("entregas", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizacionId: uuid("organizacion_id"),
	municipio: text().notNull(),
	itemId: text("item_id"),
	sugerenciaId: uuid("sugerencia_id"),
	cantidad: numeric({ precision: 8, scale:  2 }).notNull(),
	recibidoAt: timestamp("recibido_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	confirmadaPorSolicitanteAt: timestamp("confirmada_por_solicitante_at", { withTimezone: true, mode: 'string' }),
	solicitudCodigo: text("solicitud_codigo").notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
	origenTipo: text("origen_tipo"),
}, (table) => [
	index("idx_entregas_organizacion").using("btree", table.organizacionId.asc().nullsLast().op("timestamptz_ops"), table.recibidoAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [catalogoItems.id],
			name: "entregas_item_id_fkey"
		}),
	foreignKey({
			columns: [table.organizacionId],
			foreignColumns: [organizaciones.id],
			name: "entregas_organizacion_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.sugerenciaId],
			foreignColumns: [sugerenciasItem.id],
			name: "entregas_sugerencia_id_fkey"
		}).onDelete("set null"),
	check("entregas_cantidad_check", sql`(cantidad > (0)::numeric) AND (cantidad <= (9999)::numeric)`),
	check("entregas_origen_tipo_check", sql`origen_tipo = ANY (ARRAY['muro'::text, 'producto'::text, 'directo'::text])`),
	check("entregas_uno_u_otro", sql`num_nonnulls(item_id, sugerencia_id) = 1`),
]);

export const entidades = pgTable("entidades", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	nombre: text().notNull(),
	subtitulo: text(),
	descripcion: text(),
	enlaces: jsonb().default([]).notNull(),
	pie: text(),
	cobertura: text().default('nacional').notNull(),
	municipios: text().array().default([""]).notNull(),
	orden: integer().default(0).notNull(),
	activa: boolean().default(true).notNull(),
	creadaPor: uuid("creada_por"),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	actualizadaAt: timestamp("actualizada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
}, (table) => [
	index("idx_entidades_activa").using("btree", table.activa.asc().nullsLast().op("int4_ops"), table.orden.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.creadaPor],
			foreignColumns: [usersInAuth.id],
			name: "entidades_creada_por_fkey"
		}).onDelete("set null"),
	pgPolicy("admin lee entidades", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM administradores a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid))))` }),
	check("entidades_cobertura_check", sql`cobertura = ANY (ARRAY['nacional'::text, 'local'::text])`),
	check("entidades_cobertura_coherente", sql`(cobertura = 'nacional'::text) OR (array_length(municipios, 1) >= 1)`),
	check("entidades_descripcion_check", sql`char_length(descripcion) <= 600`),
	check("entidades_enlaces_validos", sql`CHECK (enlaces_validos(enlaces`),
	check("entidades_nombre_check", sql`(char_length(TRIM(BOTH FROM nombre)) >= 3) AND (char_length(TRIM(BOTH FROM nombre)) <= 80)`),
	check("entidades_pie_check", sql`char_length(pie) <= 400`),
	check("entidades_subtitulo_check", sql`(char_length(subtitulo) >= 1) AND (char_length(subtitulo) <= 120)`),
]);

export const solicitudesContacto = pgTable("solicitudes_contacto", {
	solicitudId: uuid("solicitud_id").primaryKey().notNull(),
	nombre: text(),
	telefono: text(),
	correo: text(),
	consentimientoVersion: text("consentimiento_version"),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_solicitudes_contacto_solicitud").using("btree", table.solicitudId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.solicitudId],
			foreignColumns: [solicitudes.id],
			name: "solicitudes_contacto_solicitud_id_fkey"
		}).onDelete("cascade"),
	check("solicitudes_contacto_con_consentimiento", sql`consentimiento_version IS NOT NULL`),
	check("solicitudes_contacto_correo_check", sql`(correo IS NULL) OR (correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)`),
	check("solicitudes_contacto_nombre_check", sql`(nombre IS NULL) OR ((char_length(nombre) >= 1) AND (char_length(nombre) <= 80))`),
	check("solicitudes_contacto_telefono_check", sql`(telefono IS NULL) OR (telefono ~ '^[0-9+()\- ]{6,20}$'::text)`),
	check("solicitudes_contacto_tiene_algo", sql`(nombre IS NOT NULL) OR (telefono IS NOT NULL) OR (correo IS NOT NULL)`),
]);

export const reportes = pgTable("reportes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tipoObjeto: text("tipo_objeto").notNull(),
	objetoId: uuid("objeto_id").notNull(),
	motivo: text().notNull(),
	nota: text(),
	atendido: boolean().default(false).notNull(),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	pgPolicy("admin actualiza reportes", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM administradores a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid))))` }),
	pgPolicy("admin lee reportes", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("reportar es publico", { as: "permissive", for: "insert", to: ["public"] }),
	check("reportes_motivo_check", sql`motivo = ANY (ARRAY['datos_personales'::text, 'estafa'::text, 'contenido_ofensivo'::text, 'informacion_falsa'::text, 'menor_de_edad'::text, 'extorsion_resena'::text, 'discriminacion'::text, 'otro'::text])`),
	check("reportes_nota_check", sql`char_length(nota) <= 300`),
	check("reportes_tipo_objeto_check", sql`tipo_objeto = ANY (ARRAY['solicitud'::text, 'respuesta'::text, 'perfil'::text, 'entidad'::text, 'proveedor'::text, 'resena'::text])`),
]);

export const zonas = pgTable("zonas", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	municipio: text().notNull(),
	nombre: text().notNull(),
	tipo: text().notNull(),
	activa: boolean().default(true).notNull(),
	orden: integer().default(0).notNull(),
	estado: text().default('aprobada').notNull(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	revisadaPor: uuid("revisada_por"),
	revisadaAt: timestamp("revisada_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_zonas_municipio").using("btree", table.municipio.asc().nullsLast().op("int4_ops"), table.orden.asc().nullsLast().op("text_ops"), table.nombre.asc().nullsLast().op("text_ops")).where(sql`activa`),
	index("idx_zonas_propuestas").using("btree", table.creadaAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(estado = 'propuesta'::text)`),
	foreignKey({
			columns: [table.municipio],
			foreignColumns: [municipios.codigoDane],
			name: "zonas_municipio_fkey"
		}),
	foreignKey({
			columns: [table.revisadaPor],
			foreignColumns: [usersInAuth.id],
			name: "zonas_revisada_por_fkey"
		}).onDelete("set null"),
	unique("zonas_municipio_nombre_key").on(table.municipio, table.nombre),
	pgPolicy("zonas lectura publica", { as: "permissive", for: "select", to: ["public"], using: sql`((activa = true) AND (estado = 'aprobada'::text))` }),
	check("zonas_estado_check", sql`estado = ANY (ARRAY['propuesta'::text, 'aprobada'::text, 'rechazada'::text])`),
	check("zonas_nombre_check", sql`(char_length(TRIM(BOTH FROM nombre)) >= 2) AND (char_length(TRIM(BOTH FROM nombre)) <= 60)`),
	check("zonas_tipo_check", sql`tipo = ANY (ARRAY['comuna'::text, 'corregimiento'::text, 'barrio'::text])`),
]);

export const catalogoOficios = pgTable("catalogo_oficios", {
	id: text().primaryKey().notNull(),
	grupo: text().notNull(),
	nombre: text().notNull(),
	riesgo: text().default('bajo').notNull(),
	activo: boolean().default(true).notNull(),
	orden: integer().default(0).notNull(),
}, (table) => [
	pgPolicy("oficios lectura publica", { as: "permissive", for: "select", to: ["public"], using: sql`(activo = true)` }),
	check("catalogo_oficios_grupo_check", sql`grupo = ANY (ARRAY['comida'::text, 'belleza'::text, 'confeccion'::text, 'transporte'::text, 'aseo'::text, 'cuidado'::text, 'reparacion'::text, 'otros'::text])`),
	check("catalogo_oficios_nombre_check", sql`(char_length(TRIM(BOTH FROM nombre)) >= 2) AND (char_length(TRIM(BOTH FROM nombre)) <= 60)`),
	check("catalogo_oficios_riesgo_check", sql`riesgo = ANY (ARRAY['bajo'::text, 'alto'::text])`),
]);

export const sugerenciasItem = pgTable("sugerencias_item", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	nombrePropuesto: text("nombre_propuesto").notNull(),
	categoriaSugerida: text("categoria_sugerida"),
	unidadSugerida: text("unidad_sugerida"),
	propuestaPor: uuid("propuesta_por"),
	origen: text().notNull(),
	estado: text().default('pendiente').notNull(),
	itemResultanteId: text("item_resultante_id"),
	revisadaPor: uuid("revisada_por"),
	revisadaAt: timestamp("revisada_at", { withTimezone: true, mode: 'string' }),
	notaRevision: text("nota_revision"),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
	tipo: text().default('item').notNull(),
}, (table) => [
	index("idx_sugerencias_estado").using("btree", table.estado.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.itemResultanteId],
			foreignColumns: [catalogoItems.id],
			name: "sugerencias_item_item_resultante_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.propuestaPor],
			foreignColumns: [usersInAuth.id],
			name: "sugerencias_item_propuesta_por_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.revisadaPor],
			foreignColumns: [usersInAuth.id],
			name: "sugerencias_item_revisada_por_fkey"
		}).onDelete("set null"),
	pgPolicy("admin lee sugerencias", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM administradores a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid))))` }),
	check("sugerencias_item_categoria_sugerida_check", sql`categoria_sugerida = ANY (ARRAY['alimentacion'::text, 'aseo'::text, 'salud'::text, 'abrigo'::text, 'cocina'::text, 'otros'::text, 'servicios'::text, 'mascotas'::text])`),
	check("sugerencias_item_estado_check", sql`estado = ANY (ARRAY['pendiente'::text, 'aprobada'::text, 'rechazada'::text, 'fusionada'::text])`),
	check("sugerencias_item_nombre_propuesto_check", sql`(char_length(TRIM(BOTH FROM nombre_propuesto)) >= 2) AND (char_length(TRIM(BOTH FROM nombre_propuesto)) <= 60)`),
	check("sugerencias_item_nota_revision_check", sql`char_length(nota_revision) <= 300`),
	check("sugerencias_item_origen_check", sql`origen = ANY (ARRAY['solicitante'::text, 'ofertador'::text, 'aliado'::text, 'proveedor'::text])`),
	check("sugerencias_item_tipo_check", sql`tipo = ANY (ARRAY['item'::text, 'oficio'::text])`),
	check("sugerencias_item_unidad_sugerida_check", sql`(char_length(unidad_sugerida) >= 1) AND (char_length(unidad_sugerida) <= 20)`),
]);

export const organizaciones = pgTable("organizaciones", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	nombre: text().notNull(),
	tipo: text().default('fundacion').notNull(),
	nit: text().notNull(),
	slug: text().notNull(),
	municipios: text().array().default([""]).notNull(),
	direccionAcopio: text("direccion_acopio"),
	horarioAcopio: text("horario_acopio"),
	activa: boolean().default(true).notNull(),
	creadaPor: uuid("creada_por"),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	actualizadaAt: timestamp("actualizada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
	telefono: text(),
	latitud: numeric({ precision: 9, scale:  6 }),
	longitud: numeric({ precision: 9, scale:  6 }),
}, (table) => [
	foreignKey({
			columns: [table.creadaPor],
			foreignColumns: [usersInAuth.id],
			name: "organizaciones_creada_por_fkey"
		}).onDelete("set null"),
	unique("organizaciones_nit_key").on(table.nit),
	unique("organizaciones_slug_key").on(table.slug),
	check("organizaciones_direccion_acopio_check", sql`char_length(direccion_acopio) <= 200`),
	check("organizaciones_horario_acopio_check", sql`char_length(horario_acopio) <= 200`),
	check("organizaciones_municipios_check", sql`array_length(municipios, 1) >= 1`),
	check("organizaciones_nit_check", sql`nit ~ '^[0-9]{5,15}(-[0-9])?$'::text`),
	check("organizaciones_nombre_check", sql`(char_length(TRIM(BOTH FROM nombre)) >= 3) AND (char_length(TRIM(BOTH FROM nombre)) <= 80)`),
	check("organizaciones_punto_completo", sql`num_nonnulls(latitud, longitud) <> 1`),
	check("organizaciones_slug_check", sql`slug ~ '^[a-z0-9-]{3,40}$'::text`),
	check("organizaciones_telefono_check", sql`(telefono IS NULL) OR ((char_length(telefono) >= 7) AND (char_length(telefono) <= 20))`),
	check("organizaciones_tipo_check", sql`tipo = ANY (ARRAY['fundacion'::text, 'corporacion'::text, 'entidad_publica'::text, 'junta'::text, 'otra'::text])`),
]);

export const invitacionesOrganizacion = pgTable("invitaciones_organizacion", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizacionId: uuid("organizacion_id").notNull(),
	codigo: text().notNull(),
	rolOtorgado: text("rol_otorgado").default('miembro').notNull(),
	creadaPor: uuid("creada_por"),
	expiraAt: timestamp("expira_at", { withTimezone: true, mode: 'string' }).notNull(),
	usosMax: integer("usos_max").default(1).notNull(),
	usos: integer().default(0).notNull(),
	activa: boolean().default(true).notNull(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_invitaciones_org").using("btree", table.organizacionId.asc().nullsLast().op("bool_ops"), table.activa.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.creadaPor],
			foreignColumns: [perfiles.id],
			name: "invitaciones_organizacion_creada_por_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizacionId],
			foreignColumns: [organizaciones.id],
			name: "invitaciones_organizacion_organizacion_id_fkey"
		}).onDelete("cascade"),
	unique("invitaciones_organizacion_codigo_key").on(table.codigo),
	check("invitaciones_organizacion_codigo_check", sql`codigo ~ '^[a-f0-9]{24}$'::text`),
	check("invitaciones_organizacion_rol_otorgado_check", sql`rol_otorgado = ANY (ARRAY['coordinador'::text, 'miembro'::text])`),
	check("invitaciones_organizacion_usos_check", sql`usos >= 0`),
	check("invitaciones_organizacion_usos_max_check", sql`(usos_max >= 1) AND (usos_max <= 200)`),
]);

export const servidores = pgTable("servidores", {
	perfilId: uuid("perfil_id").primaryKey().notNull(),
	profesion: text().notNull(),
	entidadMatricula: text("entidad_matricula").notNull(),
	numeroMatricula: text("numero_matricula").notNull(),
	verificado: boolean().default(false).notNull(),
	verificadoAt: timestamp("verificado_at", { withTimezone: true, mode: 'string' }),
	verificadoPor: uuid("verificado_por"),
	servicios: text().array().default([""]).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.perfilId],
			foreignColumns: [perfiles.id],
			name: "servidores_perfil_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.verificadoPor],
			foreignColumns: [usersInAuth.id],
			name: "servidores_verificado_por_fkey"
		}).onDelete("set null"),
	unique("servidores_entidad_matricula_numero_matricula_key").on(table.entidadMatricula, table.numeroMatricula),
	pgPolicy("admin lee servidores", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM administradores a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid))))` }),
	pgPolicy("servidor propio insert", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("servidor propio lectura", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("servidor propio update", { as: "permissive", for: "update", to: ["authenticated"] }),
	check("servidores_entidad_matricula_check", sql`entidad_matricula = ANY (ARRAY['COPNIA'::text, 'CPNAA'::text, 'COLPSIC'::text, 'ReTHUS'::text, 'SIRNA'::text, 'OTRA'::text])`),
]);

export const administradores = pgTable("administradores", {
	userId: uuid("user_id").primaryKey().notNull(),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "administradores_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("admin se ve a si mismo", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(( SELECT auth.uid() AS uid) = user_id)` }),
]);

export const solicitudes = pgTable("solicitudes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	codigo: text().notNull(),
	municipio: text().notNull(),
	barrio: text().notNull(),
	categoria: text().notNull(),
	nota: text(),
	estado: text().default('abierta').notNull(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	confirmadaAt: timestamp("confirmada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiraAt: timestamp("expira_at", { withTimezone: true, mode: 'string' }).default(sql`(now() + '72:00:00'::interval)`).notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
	puedeRecoger: boolean("puede_recoger").default(false).notNull(),
	notaAdmin: text("nota_admin"),
	notaAdminAt: timestamp("nota_admin_at", { withTimezone: true, mode: 'string' }),
	notaAdminPor: uuid("nota_admin_por"),
	perfilId: uuid("perfil_id").notNull(),
}, (table) => [
	index("idx_solicitudes_categoria").using("btree", table.categoria.asc().nullsLast().op("text_ops")),
	index("idx_solicitudes_expira").using("btree", table.expiraAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_solicitudes_municipio").using("btree", table.municipio.asc().nullsLast().op("text_ops")),
	index("idx_solicitudes_perfil").using("btree", table.perfilId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.municipio],
			foreignColumns: [municipios.codigoDane],
			name: "solicitudes_municipio_fkey"
		}),
	foreignKey({
			columns: [table.notaAdminPor],
			foreignColumns: [usersInAuth.id],
			name: "solicitudes_nota_admin_por_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.perfilId],
			foreignColumns: [perfiles.id],
			name: "solicitudes_perfil_id_fkey"
		}).onDelete("cascade"),
	unique("solicitudes_codigo_key").on(table.codigo),
	check("solicitudes_barrio_check", sql`(char_length(barrio) >= 2) AND (char_length(barrio) <= 60)`),
	check("solicitudes_categoria_check", sql`categoria = ANY (ARRAY['alimentacion'::text, 'aseo'::text, 'salud'::text, 'abrigo'::text, 'cocina'::text, 'otros'::text, 'servicios'::text, 'mascotas'::text])`),
	check("solicitudes_estado_check", sql`estado = ANY (ARRAY['abierta'::text, 'cumplida'::text])`),
	check("solicitudes_nota_admin_check", sql`char_length(nota_admin) <= 200`),
	check("solicitudes_nota_check", sql`char_length(nota) <= 140`),
]);

export const pushOfertadores = pgTable("push_ofertadores", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	perfilId: uuid("perfil_id").notNull(),
	endpoint: text().notNull(),
	p256Dh: text("p256dh").notNull(),
	authKey: text("auth_key").notNull(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.perfilId],
			foreignColumns: [perfiles.id],
			name: "push_ofertadores_perfil_id_fkey"
		}).onDelete("cascade"),
	unique("push_ofertadores_perfil_id_endpoint_key").on(table.perfilId, table.endpoint),
]);

export const municipios = pgTable("municipios", {
	codigoDane: text("codigo_dane").primaryKey().notNull(),
	nombre: text().notNull(),
	departamento: text().notNull(),
	afectado: boolean().default(true).notNull(),
}, (table) => [
	pgPolicy("municipios lectura publica", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const catalogoServicios = pgTable("catalogo_servicios", {
	id: text().primaryKey().notNull(),
	area: text().notNull(),
	nombre: text().notNull(),
	activo: boolean().default(true).notNull(),
	orden: integer().default(0).notNull(),
}, (table) => [
	pgPolicy("servicios lectura publica", { as: "permissive", for: "select", to: ["public"], using: sql`(activo = true)` }),
	check("catalogo_servicios_area_check", sql`area = ANY (ARRAY['ingenieria'::text, 'arquitectura'::text, 'psicologia'::text, 'salud'::text, 'derecho'::text])`),
]);

export const catalogoItems = pgTable("catalogo_items", {
	id: text().primaryKey().notNull(),
	categoria: text().notNull(),
	nombre: text().notNull(),
	unidad: text().default('unidad').notNull(),
	activo: boolean().default(true).notNull(),
	orden: integer().default(0).notNull(),
	creadoPor: uuid("creado_por"),
	origen: text().default('semilla').notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.creadoPor],
			foreignColumns: [usersInAuth.id],
			name: "catalogo_items_creado_por_fkey"
		}).onDelete("set null"),
	pgPolicy("catalogo lectura publica", { as: "permissive", for: "select", to: ["public"], using: sql`(activo = true)` }),
	check("catalogo_items_categoria_check", sql`categoria = ANY (ARRAY['alimentacion'::text, 'aseo'::text, 'salud'::text, 'abrigo'::text, 'cocina'::text, 'otros'::text, 'servicios'::text, 'mascotas'::text])`),
	check("catalogo_items_origen_check", sql`origen = ANY (ARRAY['semilla'::text, 'admin'::text, 'aliado'::text, 'sugerencia'::text])`),
]);

export const solicitudItems = pgTable("solicitud_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	solicitudId: uuid("solicitud_id").notNull(),
	itemId: text("item_id"),
	cantidad: numeric({ precision: 8, scale:  2 }).notNull(),
	cubierto: boolean().default(false).notNull(),
	sugerenciaId: uuid("sugerencia_id"),
	cubiertoAt: timestamp("cubierto_at", { withTimezone: true, mode: 'string' }),
	cubiertoPor: text("cubierto_por"),
}, (table) => [
	index("idx_items_item").using("btree", table.itemId.asc().nullsLast().op("text_ops")).where(sql`(item_id IS NOT NULL)`),
	index("idx_items_solicitud").using("btree", table.solicitudId.asc().nullsLast().op("uuid_ops")),
	index("idx_items_sugerencia").using("btree", table.sugerenciaId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [catalogoItems.id],
			name: "solicitud_items_item_id_fkey"
		}),
	foreignKey({
			columns: [table.solicitudId],
			foreignColumns: [solicitudes.id],
			name: "solicitud_items_solicitud_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sugerenciaId],
			foreignColumns: [sugerenciasItem.id],
			name: "solicitud_items_sugerencia_id_fkey"
		}).onDelete("restrict"),
	check("solicitud_items_cantidad_check", sql`(cantidad > (0)::numeric) AND (cantidad <= (9999)::numeric)`),
	check("solicitud_items_cubierto_por_check", sql`(cubierto_por IS NULL) OR (cubierto_por = ANY (ARRAY['solicitante'::text, 'aliado'::text, 'entrega'::text]))`),
	check("solicitud_items_uno_u_otro", sql`num_nonnulls(item_id, sugerencia_id) = 1`),
]);

export const metricas = pgTable("metricas", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	municipio: text().notNull(),
	categoria: text().notNull(),
	cumplida: boolean().notNull(),
	horasHastaRespuesta: numeric("horas_hasta_respuesta", { precision: 6, scale:  2 }),
	horasHastaCierre: numeric("horas_hasta_cierre", { precision: 6, scale:  2 }),
	numRespuestas: integer("num_respuestas").default(0).notNull(),
	registradaAt: timestamp("registrada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
	flujo: text().default('directo').notNull(),
	conAliado: boolean("con_aliado").default(false).notNull(),
}, (table) => [
	pgPolicy("metricas lectura publica", { as: "permissive", for: "select", to: ["public"], using: sql`(es_prueba = false)` }),
]);

export const perfiles = pgTable("perfiles", {
	id: uuid().primaryKey().notNull(),
	nombreVisible: text("nombre_visible").notNull(),
	tipo: text().notNull(),
	municipios: text().array().default([""]).notNull(),
	contactoPublico: text("contacto_publico"),
	contactoTipo: text("contacto_tipo").default('whatsapp').notNull(),
	descripcion: text(),
	aceptoPublicacion: boolean("acepto_publicacion").default(false).notNull(),
	aceptoPoliticaAt: timestamp("acepto_politica_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	suspendido: boolean().default(false).notNull(),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	avisosVistosAt: timestamp("avisos_vistos_at", { withTimezone: true, mode: 'string' }),
	puedeTrasladarse: boolean("puede_trasladarse").default(false).notNull(),
	autorizacionVersion: text("autorizacion_version"),
}, (table) => [
	foreignKey({
			columns: [table.id],
			foreignColumns: [usersInAuth.id],
			name: "perfiles_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("admin lee perfiles", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM administradores a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid))))` }),
	pgPolicy("perfil propio delete", { as: "permissive", for: "delete", to: ["authenticated"] }),
	pgPolicy("perfil propio insert", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("perfil propio lectura", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("perfil propio update", { as: "permissive", for: "update", to: ["authenticated"] }),
	check("perfiles_autorizacion_completa", sql`(NOT acepto_publicacion) OR (autorizacion_version IS NOT NULL)`),
	check("perfiles_contacto_publico_check", sql`CHECK (
CASE
    WHEN (tipo = ANY (ARRAY['vecino'::text, 'aliado'::text])) THEN ((contacto_publico IS NULL) OR ((char_length(contacto_publico) >= 7) AND (char_length(contacto_publico) <= 40)))
    ELSE ((char_length(contacto_publico) >= 7) AND (char_length(contacto_publico) <= 40))
END)`),
	check("perfiles_contacto_tipo_check", sql`contacto_tipo = ANY (ARRAY['whatsapp'::text, 'telefono'::text])`),
	check("perfiles_descripcion_check", sql`char_length(descripcion) <= 300`),
	check("perfiles_nombre_visible_check", sql`(char_length(nombre_visible) >= 3) AND (char_length(nombre_visible) <= 60)`),
	check("perfiles_tipo_check", sql`tipo = ANY (ARRAY['vecino'::text, 'ofertador'::text, 'servidor'::text, 'aliado'::text])`),
]);

export const respuestas = pgTable("respuestas", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	solicitudId: uuid("solicitud_id").notNull(),
	autorId: uuid("autor_id").notNull(),
	mensaje: text().notNull(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	puedeLlevar: boolean("puede_llevar").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.autorId],
			foreignColumns: [perfiles.id],
			name: "respuestas_autor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.solicitudId],
			foreignColumns: [solicitudes.id],
			name: "respuestas_solicitud_id_fkey"
		}).onDelete("cascade"),
	unique("respuestas_solicitud_id_autor_id_key").on(table.solicitudId, table.autorId),
	pgPolicy("respuestas delete propia", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(( SELECT auth.uid() AS uid) = autor_id)` }),
	pgPolicy("respuestas insert", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("respuestas propias", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("respuestas_mensaje_check", sql`(char_length(mensaje) >= 5) AND (char_length(mensaje) <= 200)`),
]);

export const metricasServicio = pgTable("metricas_servicio", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	municipio: text().notNull(),
	oficio: text().notNull(),
	grupo: text().notNull(),
	huboRespuesta: boolean("hubo_respuesta").notNull(),
	huboConfirmacion: boolean("hubo_confirmacion").default(false).notNull(),
	horasHastaRespuesta: numeric("horas_hasta_respuesta", { precision: 6, scale:  1 }),
	esPrueba: boolean("es_prueba").default(false).notNull(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	pgPolicy("metricas servicio lectura publica", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const referencias = pgTable("referencias", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	proveedorId: uuid("proveedor_id").notNull(),
	nombreCifrado: bytea("nombre_cifrado").notNull(),
	telefonoCifrado: bytea("telefono_cifrado").notNull(),
	telefonoHash: text("telefono_hash").notNull(),
	oficioId: text("oficio_id"),
	consentimientoVersion: text("consentimiento_version").notNull(),
	consentimientoAt: timestamp("consentimiento_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	estado: text().default('pendiente').notNull(),
	revisadaPor: uuid("revisada_por"),
	revisadaAt: timestamp("revisada_at", { withTimezone: true, mode: 'string' }),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
}, (table) => [
	index("idx_referencias_proveedor").using("btree", table.proveedorId.asc().nullsLast().op("text_ops"), table.estado.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.oficioId],
			foreignColumns: [catalogoOficios.id],
			name: "referencias_oficio_id_fkey"
		}),
	foreignKey({
			columns: [table.proveedorId],
			foreignColumns: [proveedores.id],
			name: "referencias_proveedor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.revisadaPor],
			foreignColumns: [usersInAuth.id],
			name: "referencias_revisada_por_fkey"
		}).onDelete("set null"),
	check("referencias_consentimiento_version_check", sql`(char_length(TRIM(BOTH FROM consentimiento_version)) >= 3) AND (char_length(TRIM(BOTH FROM consentimiento_version)) <= 60)`),
	check("referencias_estado_check", sql`estado = ANY (ARRAY['pendiente'::text, 'confirmada'::text, 'no_contesta'::text, 'rechazada'::text])`),
]);

export const accesosReferencia = pgTable("accesos_referencia", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	referenciaId: uuid("referencia_id"),
	referenciaRef: text("referencia_ref").notNull(),
	leidaPor: uuid("leida_por"),
	lectorRef: text("lector_ref").notNull(),
	rolLector: text("rol_lector").notNull(),
	motivo: text().notNull(),
	leidaAt: timestamp("leida_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
}, (table) => [
	index("idx_accesos_referencia").using("btree", table.referenciaId.asc().nullsLast().op("timestamptz_ops"), table.leidaAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.leidaPor],
			foreignColumns: [usersInAuth.id],
			name: "accesos_referencia_leida_por_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.referenciaId],
			foreignColumns: [referencias.id],
			name: "accesos_referencia_referencia_id_fkey"
		}).onDelete("set null"),
	check("accesos_referencia_motivo_check", sql`(char_length(TRIM(BOTH FROM motivo)) >= 5) AND (char_length(TRIM(BOTH FROM motivo)) <= 200)`),
	check("accesos_referencia_rol_lector_check", sql`rol_lector = ANY (ARRAY['admin'::text, 'aliado'::text])`),
]);

export const respuestasServicio = pgTable("respuestas_servicio", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	solicitudId: uuid("solicitud_id").notNull(),
	proveedorId: uuid("proveedor_id").notNull(),
	mensaje: text().notNull(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.proveedorId],
			foreignColumns: [proveedores.id],
			name: "respuestas_servicio_proveedor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.solicitudId],
			foreignColumns: [solicitudesServicio.id],
			name: "respuestas_servicio_solicitud_id_fkey"
		}).onDelete("cascade"),
	unique("respuestas_servicio_solicitud_id_proveedor_id_key").on(table.solicitudId, table.proveedorId),
	check("respuestas_servicio_mensaje_check", sql`(char_length(mensaje) >= 10) AND (char_length(mensaje) <= 200)`),
]);

export const serviciosPrestados = pgTable("servicios_prestados", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	proveedorId: uuid("proveedor_id").notNull(),
	oficioId: text("oficio_id"),
	codigoHash: text("codigo_hash").notNull(),
	confirmadoAt: timestamp("confirmado_at", { withTimezone: true, mode: 'string' }),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiraAt: timestamp("expira_at", { withTimezone: true, mode: 'string' }).default(sql`(now() + '30 days'::interval)`).notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.oficioId],
			foreignColumns: [catalogoOficios.id],
			name: "servicios_prestados_oficio_id_fkey"
		}),
	foreignKey({
			columns: [table.proveedorId],
			foreignColumns: [proveedores.id],
			name: "servicios_prestados_proveedor_id_fkey"
		}).onDelete("cascade"),
	unique("servicios_prestados_codigo_hash_key").on(table.codigoHash),
]);

export const resenas = pgTable("resenas", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	servicioId: uuid("servicio_id").notNull(),
	proveedorId: uuid("proveedor_id").notNull(),
	cumplimiento: smallint().notNull(),
	trato: smallint().notNull(),
	puntualidad: smallint().notNull(),
	comentario: text(),
	replica: text(),
	replicaAt: timestamp("replica_at", { withTimezone: true, mode: 'string' }),
	oculta: boolean().default(false).notNull(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
}, (table) => [
	index("idx_resenas_proveedor").using("btree", table.proveedorId.asc().nullsLast().op("uuid_ops")).where(sql`(NOT oculta)`),
	foreignKey({
			columns: [table.proveedorId],
			foreignColumns: [proveedores.id],
			name: "resenas_proveedor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.servicioId],
			foreignColumns: [serviciosPrestados.id],
			name: "resenas_servicio_id_fkey"
		}).onDelete("cascade"),
	unique("resenas_servicio_id_key").on(table.servicioId),
	pgPolicy("admin lee resenas", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM administradores a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid))))` }),
	check("resenas_comentario_check", sql`char_length(comentario) <= 140`),
	check("resenas_cumplimiento_check", sql`(cumplimiento >= 1) AND (cumplimiento <= 3)`),
	check("resenas_puntualidad_check", sql`(puntualidad >= 1) AND (puntualidad <= 3)`),
	check("resenas_replica_check", sql`char_length(replica) <= 140`),
	check("resenas_trato_check", sql`(trato >= 1) AND (trato <= 3)`),
]);

export const proveedores = pgTable("proveedores", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	perfilId: uuid("perfil_id").notNull(),
	organizacionId: uuid("organizacion_id"),
	nombreVisible: text("nombre_visible").notNull(),
	tipo: text().notNull(),
	telefono: text().notNull(),
	telefonoVerificado: boolean("telefono_verificado").default(false).notNull(),
	verificadoAt: timestamp("verificado_at", { withTimezone: true, mode: 'string' }),
	verificadoPor: uuid("verificado_por"),
	municipio: text().notNull(),
	zonaId: uuid("zona_id"),
	zonaTexto: text("zona_texto"),
	modalidad: text().array().default([""]).notNull(),
	dias: text().array().default([""]).notNull(),
	franjas: text().array().default([""]).notNull(),
	mediosPago: text("medios_pago").array().default([""]).notNull(),
	descripcion: text(),
	aceptoPublicacion: boolean("acepto_publicacion").default(false).notNull(),
	autorizacionVersion: text("autorizacion_version").notNull(),
	autorizacionAt: timestamp("autorizacion_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	altaAsistida: boolean("alta_asistida").default(false).notNull(),
	suspendido: boolean().default(false).notNull(),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	actualizadoAt: timestamp("actualizado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
	latitud: numeric({ precision: 9, scale:  6 }),
	longitud: numeric({ precision: 9, scale:  6 }),
	aceptoMapa: boolean("acepto_mapa").default(false).notNull(),
	mapaVersion: text("mapa_version"),
	mapaAt: timestamp("mapa_at", { withTimezone: true, mode: 'string' }),
	aceptoFoto: boolean("acepto_foto").default(false).notNull(),
	fotoVersion: text("foto_version"),
	fotoAt: timestamp("foto_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_proveedores_municipio").using("btree", table.municipio.asc().nullsLast().op("text_ops")).where(sql`((NOT suspendido) AND acepto_publicacion)`),
	index("idx_proveedores_organizacion").using("btree", table.organizacionId.asc().nullsLast().op("uuid_ops")).where(sql`(organizacion_id IS NOT NULL)`),
	foreignKey({
			columns: [table.municipio],
			foreignColumns: [municipios.codigoDane],
			name: "proveedores_municipio_fkey"
		}),
	foreignKey({
			columns: [table.organizacionId],
			foreignColumns: [organizaciones.id],
			name: "proveedores_organizacion_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.perfilId],
			foreignColumns: [perfiles.id],
			name: "proveedores_perfil_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.verificadoPor],
			foreignColumns: [usersInAuth.id],
			name: "proveedores_verificado_por_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.zonaId],
			foreignColumns: [zonas.id],
			name: "proveedores_zona_id_fkey"
		}).onDelete("set null"),
	unique("proveedores_perfil_id_key").on(table.perfilId),
	pgPolicy("admin lee proveedores", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM administradores a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid))))` }),
	check("proveedores_asistida_con_organizacion", sql`(NOT alta_asistida) OR (organizacion_id IS NOT NULL)`),
	check("proveedores_autorizacion_version_check", sql`(char_length(TRIM(BOTH FROM autorizacion_version)) >= 3) AND (char_length(TRIM(BOTH FROM autorizacion_version)) <= 60)`),
	check("proveedores_coordenadas_colombia", sql`((latitud IS NULL) AND (longitud IS NULL)) OR (((latitud >= '-4.5'::numeric) AND (latitud <= 13.5)) AND ((longitud >= '-82.0'::numeric) AND (longitud <= '-66.0'::numeric)))`),
	check("proveedores_descripcion_check", sql`char_length(descripcion) <= 300`),
	check("proveedores_foto_completa", sql`(NOT acepto_foto) OR ((foto_version IS NOT NULL) AND (foto_at IS NOT NULL))`),
	check("proveedores_mapa_completo", sql`(NOT acepto_mapa) OR ((latitud IS NOT NULL) AND (longitud IS NOT NULL) AND (mapa_version IS NOT NULL))`),
	check("proveedores_nombre_visible_check", sql`(char_length(nombre_visible) >= 3) AND (char_length(nombre_visible) <= 60)`),
	check("proveedores_telefono_check", sql`telefono ~ '^[0-9+()\- ]{7,20}$'::text`),
	check("proveedores_tiene_zona", sql`num_nonnulls(zona_id, zona_texto) >= 1`),
	check("proveedores_tipo_check", sql`tipo = ANY (ARRAY['persona'::text, 'microempresa'::text])`),
	check("proveedores_zona_texto_check", sql`(char_length(zona_texto) >= 2) AND (char_length(zona_texto) <= 60)`),
]);

export const solicitudesServicio = pgTable("solicitudes_servicio", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	codigo: text().notNull(),
	oficioId: text("oficio_id"),
	municipio: text().notNull(),
	zonaId: uuid("zona_id"),
	zonaTexto: text("zona_texto"),
	urgencia: text().notNull(),
	capacidadPago: text("capacidad_pago").notNull(),
	nota: text(),
	estado: text().default('abierta').notNull(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiraAt: timestamp("expira_at", { withTimezone: true, mode: 'string' }).default(sql`(now() + '15 days'::interval)`).notNull(),
	esPrueba: boolean("es_prueba").default(false).notNull(),
	perfilId: uuid("perfil_id").notNull(),
	grupo: text().notNull(),
	detalle: text().notNull(),
	revisadaAt: timestamp("revisada_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_solicitudes_servicio_perfil").using("btree", table.perfilId.asc().nullsLast().op("uuid_ops")),
	index("idx_solicitudes_servicio_sin_revisar").using("btree", table.creadaAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(revisada_at IS NULL)`),
	index("idx_solicitudes_servicio_vigentes").using("btree", table.municipio.asc().nullsLast().op("text_ops"), table.grupo.asc().nullsLast().op("text_ops")).where(sql`(estado = 'abierta'::text)`),
	foreignKey({
			columns: [table.municipio],
			foreignColumns: [municipios.codigoDane],
			name: "solicitudes_servicio_municipio_fkey"
		}),
	foreignKey({
			columns: [table.oficioId],
			foreignColumns: [catalogoOficios.id],
			name: "solicitudes_servicio_oficio_id_fkey"
		}),
	foreignKey({
			columns: [table.perfilId],
			foreignColumns: [perfiles.id],
			name: "solicitudes_servicio_perfil_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.zonaId],
			foreignColumns: [zonas.id],
			name: "solicitudes_servicio_zona_id_fkey"
		}).onDelete("set null"),
	unique("solicitudes_servicio_codigo_key").on(table.codigo),
	check("solicitudes_servicio_capacidad_pago_check", sql`capacidad_pago = ANY (ARRAY['puedo_pagar'::text, 'pago_poco'::text, 'no_puedo_pagar'::text])`),
	check("solicitudes_servicio_detalle_check", sql`(char_length(btrim(detalle)) >= 3) AND (char_length(btrim(detalle)) <= 80)`),
	check("solicitudes_servicio_estado_check", sql`estado = ANY (ARRAY['abierta'::text, 'resuelta'::text])`),
	check("solicitudes_servicio_grupo_check", sql`grupo = ANY (ARRAY['comida'::text, 'belleza'::text, 'confeccion'::text, 'transporte'::text, 'aseo'::text, 'cuidado'::text, 'reparacion'::text, 'otros'::text])`),
	check("solicitudes_servicio_nota_check", sql`char_length(nota) <= 140`),
	check("solicitudes_servicio_tiene_zona", sql`num_nonnulls(zona_id, zona_texto) >= 1`),
	check("solicitudes_servicio_urgencia_check", sql`urgencia = ANY (ARRAY['hoy'::text, 'esta_semana'::text, 'sin_prisa'::text])`),
	check("solicitudes_servicio_zona_texto_check", sql`(char_length(zona_texto) >= 2) AND (char_length(zona_texto) <= 60)`),
]);

export const chats = pgTable("chats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	respuestaServicioId: uuid("respuesta_servicio_id"),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	cerradoAt: timestamp("cerrado_at", { withTimezone: true, mode: 'string' }),
	respuestaInsumoId: uuid("respuesta_insumo_id"),
	productoId: uuid("producto_id"),
	publicacionId: uuid("publicacion_id"),
	iniciadoPor: uuid("iniciado_por"),
	proveedorId: uuid("proveedor_id"),
	vistoOfreceAt: timestamp("visto_ofrece_at", { withTimezone: true, mode: 'string' }),
	vistoPideAt: timestamp("visto_pide_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("chats_producto_iniciado_key").using("btree", table.productoId.asc().nullsLast().op("uuid_ops"), table.iniciadoPor.asc().nullsLast().op("uuid_ops")).where(sql`(producto_id IS NOT NULL)`),
	uniqueIndex("chats_proveedor_iniciado_key").using("btree", table.proveedorId.asc().nullsLast().op("uuid_ops"), table.iniciadoPor.asc().nullsLast().op("uuid_ops")).where(sql`(proveedor_id IS NOT NULL)`),
	uniqueIndex("chats_publicacion_iniciado_key").using("btree", table.publicacionId.asc().nullsLast().op("uuid_ops"), table.iniciadoPor.asc().nullsLast().op("uuid_ops")).where(sql`(publicacion_id IS NOT NULL)`),
	uniqueIndex("chats_respuesta_insumo_key").using("btree", table.respuestaInsumoId.asc().nullsLast().op("uuid_ops")).where(sql`(respuesta_insumo_id IS NOT NULL)`),
	foreignKey({
			columns: [table.iniciadoPor],
			foreignColumns: [perfiles.id],
			name: "chats_iniciado_por_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productoId],
			foreignColumns: [productos.id],
			name: "chats_producto_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.proveedorId],
			foreignColumns: [proveedores.id],
			name: "chats_proveedor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.publicacionId],
			foreignColumns: [publicacionesMuro.id],
			name: "chats_publicacion_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.respuestaInsumoId],
			foreignColumns: [respuestas.id],
			name: "chats_respuesta_insumo_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.respuestaServicioId],
			foreignColumns: [respuestasServicio.id],
			name: "chats_respuesta_servicio_id_fkey"
		}).onDelete("cascade"),
	unique("chats_respuesta_servicio_id_key").on(table.respuestaServicioId),
	check("chats_iniciado_por_donde_toca", sql`((producto_id IS NOT NULL) OR (publicacion_id IS NOT NULL) OR (proveedor_id IS NOT NULL)) = (iniciado_por IS NOT NULL)`),
	check("chats_un_origen", sql`num_nonnulls(respuesta_servicio_id, respuesta_insumo_id, producto_id, publicacion_id, proveedor_id) = 1`),
]);

export const publicacionesMuro = pgTable("publicaciones_muro", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	cara: text().notNull(),
	perfilId: uuid("perfil_id").notNull(),
	autorNombre: text("autor_nombre"),
	autorizacionVersion: text("autorizacion_version"),
	autorizacionAt: timestamp("autorizacion_at", { withTimezone: true, mode: 'string' }),
	categoria: text().notNull(),
	titulo: text().notNull(),
	detalle: text(),
	municipio: text().notNull(),
	zonaId: uuid("zona_id"),
	estado: text().default('abierta').notNull(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiraAt: timestamp("expira_at", { withTimezone: true, mode: 'string' }),
	esPrueba: boolean("es_prueba").default(false).notNull(),
	acopioId: uuid("acopio_id"),
}, (table) => [
	index("idx_muro_abierta").using("btree", table.cara.asc().nullsLast().op("text_ops"), table.municipio.asc().nullsLast().op("text_ops"), table.creadaAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(estado = 'abierta'::text)`),
	index("idx_muro_perfil").using("btree", table.perfilId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.acopioId],
			foreignColumns: [organizaciones.id],
			name: "publicaciones_muro_acopio_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.municipio],
			foreignColumns: [municipios.codigoDane],
			name: "publicaciones_muro_municipio_fkey"
		}),
	foreignKey({
			columns: [table.perfilId],
			foreignColumns: [perfiles.id],
			name: "publicaciones_muro_perfil_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.zonaId],
			foreignColumns: [zonas.id],
			name: "publicaciones_muro_zona_id_fkey"
		}).onDelete("set null"),
	check("muro_ofrece_con_nombre", sql`(cara <> 'ofrece'::text) OR ((perfil_id IS NOT NULL) AND (autor_nombre IS NOT NULL) AND (autorizacion_version IS NOT NULL))`),
	check("publicaciones_muro_cara_check", sql`cara = ANY (ARRAY['ofrece'::text, 'necesita'::text])`),
	check("publicaciones_muro_detalle_check", sql`char_length(detalle) <= 300`),
	check("publicaciones_muro_estado_check", sql`estado = ANY (ARRAY['abierta'::text, 'resuelta'::text])`),
	check("publicaciones_muro_titulo_check", sql`(char_length(titulo) >= 3) AND (char_length(titulo) <= 140)`),
]);

export const productos = pgTable("productos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	proveedorId: uuid("proveedor_id").notNull(),
	nombre: text().notNull(),
	detalle: text(),
	modo: text().default('normal').notNull(),
	precioDesde: numeric("precio_desde", { precision: 12, scale:  2 }),
	unidad: text(),
	disponible: boolean().default(true).notNull(),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_productos_proveedor").using("btree", table.proveedorId.asc().nullsLast().op("uuid_ops")).where(sql`disponible`),
	foreignKey({
			columns: [table.proveedorId],
			foreignColumns: [proveedores.id],
			name: "productos_proveedor_id_fkey"
		}).onDelete("cascade"),
	check("productos_detalle_check", sql`char_length(detalle) <= 300`),
	check("productos_modo_check", sql`modo = ANY (ARRAY['gratis'::text, 'aporte'::text, 'solidario'::text, 'normal'::text])`),
	check("productos_nombre_check", sql`(char_length(nombre) >= 2) AND (char_length(nombre) <= 140)`),
	check("productos_unidad_check", sql`unidad = ANY (ARRAY['unidad'::text, 'libra'::text, 'kilo'::text, 'docena'::text, 'plato'::text, 'trabajo'::text])`),
]);

export const imagenes = pgTable("imagenes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	objetoTipo: text("objeto_tipo").notNull(),
	objetoId: uuid("objeto_id"),
	ruta: text().notNull(),
	estado: text().default('en_cola').notNull(),
	motivo: text(),
	ancho: integer(),
	alto: integer(),
	bytes: integer(),
	subidaAt: timestamp("subida_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	revisadaAt: timestamp("revisada_at", { withTimezone: true, mode: 'string' }),
	revisadaPor: uuid("revisada_por"),
}, (table) => [
	index("idx_imagenes_cola").using("btree", table.estado.asc().nullsLast().op("text_ops"), table.subidaAt.asc().nullsLast().op("text_ops")).where(sql`(estado = 'en_cola'::text)`),
	index("idx_imagenes_objeto").using("btree", table.objetoTipo.asc().nullsLast().op("text_ops"), table.objetoId.asc().nullsLast().op("uuid_ops")).where(sql`(objeto_id IS NOT NULL)`),
	foreignKey({
			columns: [table.revisadaPor],
			foreignColumns: [usersInAuth.id],
			name: "imagenes_revisada_por_fkey"
		}).onDelete("set null"),
	unique("imagenes_ruta_key").on(table.ruta),
	check("imagenes_estado_check", sql`estado = ANY (ARRAY['en_cola'::text, 'aprobada'::text, 'rechazada'::text])`),
	check("imagenes_objeto_tipo_check", sql`objeto_tipo = ANY (ARRAY['muro'::text, 'producto'::text, 'proveedor'::text])`),
]);

export const pqr = pgTable("pqr", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tipo: text().notNull(),
	asunto: text().notNull(),
	detalle: text().notNull(),
	tokenHash: text("token_hash").notNull(),
	estado: text().default('abierta').notNull(),
	respuesta: text(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	respondidaAt: timestamp("respondida_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_pqr_abiertas").using("btree", table.creadaAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(estado = 'abierta'::text)`),
	unique("pqr_token_hash_key").on(table.tokenHash),
	check("pqr_asunto_check", sql`(char_length(asunto) >= 3) AND (char_length(asunto) <= 140)`),
	check("pqr_detalle_check", sql`(char_length(detalle) >= 10) AND (char_length(detalle) <= 1000)`),
	check("pqr_estado_check", sql`estado = ANY (ARRAY['abierta'::text, 'respondida'::text])`),
	check("pqr_respondida_con_respuesta", sql`(estado <> 'respondida'::text) OR ((respuesta IS NOT NULL) AND (respondida_at IS NOT NULL))`),
	check("pqr_respuesta_check", sql`char_length(respuesta) <= 2000`),
	check("pqr_sin_pii", sql`(NOT contiene_pii(asunto)) AND (NOT contiene_pii(detalle))`),
	check("pqr_tipo_check", sql`tipo = ANY (ARRAY['peticion'::text, 'queja'::text, 'reclamo'::text, 'sugerencia'::text])`),
]);

export const codigosAcceso = pgTable("codigos_acceso", {
	perfilId: uuid("perfil_id").primaryKey().notNull(),
	codigoHash: text("codigo_hash").notNull(),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	creadoPor: uuid("creado_por"),
	usadoAt: timestamp("usado_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.creadoPor],
			foreignColumns: [usersInAuth.id],
			name: "codigos_acceso_creado_por_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.perfilId],
			foreignColumns: [perfiles.id],
			name: "codigos_acceso_perfil_id_fkey"
		}).onDelete("cascade"),
	unique("codigos_acceso_codigo_hash_key").on(table.codigoHash),
]);

export const destapesContacto = pgTable("destapes_contacto", {
	solicitudId: uuid("solicitud_id").notNull(),
	perfilId: uuid("perfil_id").notNull(),
	destapadoAt: timestamp("destapado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.perfilId],
			foreignColumns: [perfiles.id],
			name: "destapes_contacto_perfil_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.solicitudId],
			foreignColumns: [solicitudes.id],
			name: "destapes_contacto_solicitud_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.solicitudId, table.perfilId], name: "destapes_contacto_pkey"}),
]);

export const proveedorOficios = pgTable("proveedor_oficios", {
	proveedorId: uuid("proveedor_id").notNull(),
	oficioId: text("oficio_id").notNull(),
	modo: text().notNull(),
	precioDesde: numeric("precio_desde", { precision: 10, scale:  0 }),
	unidad: text(),
}, (table) => [
	index("idx_proveedor_oficios_oficio").using("btree", table.oficioId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.oficioId],
			foreignColumns: [catalogoOficios.id],
			name: "proveedor_oficios_oficio_id_fkey"
		}),
	foreignKey({
			columns: [table.proveedorId],
			foreignColumns: [proveedores.id],
			name: "proveedor_oficios_proveedor_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.proveedorId, table.oficioId], name: "proveedor_oficios_pkey"}),
	check("precio_con_unidad", sql`(precio_desde IS NULL) OR (unidad IS NOT NULL)`),
	check("precio_solo_si_cobra", sql`(modo = ANY (ARRAY['solidario'::text, 'normal'::text])) OR (precio_desde IS NULL)`),
	check("proveedor_oficios_modo_check", sql`modo = ANY (ARRAY['gratis'::text, 'aporte'::text, 'solidario'::text, 'normal'::text])`),
	check("proveedor_oficios_precio_desde_check", sql`(precio_desde IS NULL) OR ((precio_desde >= (0)::numeric) AND (precio_desde <= (99999999)::numeric))`),
	check("proveedor_oficios_unidad_check", sql`unidad = ANY (ARRAY['hora'::text, 'trabajo'::text, 'dia'::text, 'prenda'::text, 'viaje'::text, 'plato'::text, 'unidad'::text])`),
]);

export const miembrosOrganizacion = pgTable("miembros_organizacion", {
	organizacionId: uuid("organizacion_id").notNull(),
	perfilId: uuid("perfil_id").notNull(),
	rol: text().default('miembro').notNull(),
	estado: text().default('pendiente').notNull(),
	puedeVerIdentidad: boolean("puede_ver_identidad").default(false).notNull(),
	puedeModerar: boolean("puede_moderar").default(false).notNull(),
	invitacionId: uuid("invitacion_id"),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	aprobadoPor: uuid("aprobado_por"),
	aprobadoAt: timestamp("aprobado_at", { withTimezone: true, mode: 'string' }),
	permisoIdentidadPor: uuid("permiso_identidad_por"),
	permisoIdentidadAt: timestamp("permiso_identidad_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_miembros_perfil").using("btree", table.perfilId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.aprobadoPor],
			foreignColumns: [perfiles.id],
			name: "miembros_organizacion_aprobado_por_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.invitacionId],
			foreignColumns: [invitacionesOrganizacion.id],
			name: "miembros_organizacion_invitacion_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizacionId],
			foreignColumns: [organizaciones.id],
			name: "miembros_organizacion_organizacion_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.perfilId],
			foreignColumns: [perfiles.id],
			name: "miembros_organizacion_perfil_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.permisoIdentidadPor],
			foreignColumns: [perfiles.id],
			name: "miembros_organizacion_permiso_identidad_por_fkey"
		}).onDelete("set null"),
	primaryKey({ columns: [table.organizacionId, table.perfilId], name: "miembros_organizacion_pkey"}),
	check("miembros_organizacion_estado_check", sql`estado = ANY (ARRAY['pendiente'::text, 'activo'::text, 'inactivo'::text])`),
	check("miembros_organizacion_rol_check", sql`rol = ANY (ARRAY['coordinador'::text, 'miembro'::text])`),
]);
export const entidadesPublicas = pgView("entidades_publicas", {	id: uuid(),
	nombre: text(),
	subtitulo: text(),
	descripcion: text(),
	enlaces: jsonb(),
	pie: text(),
	cobertura: text(),
	municipios: text().array(),
	orden: integer(),
}).as(sql`SELECT id, nombre, subtitulo, descripcion, enlaces, pie, cobertura, municipios, orden FROM entidades e WHERE activa`);

export const municipiosConEntidades = pgView("municipios_con_entidades", {	codigoDane: text("codigo_dane"),
	nombre: text(),
	departamento: text(),
}).as(sql`SELECT DISTINCT m.codigo_dane, m.nombre, m.departamento FROM municipios m JOIN entidades e ON m.codigo_dane = ANY (e.municipios) WHERE e.activa AND e.cobertura = 'local'::text`);

export const solicitudesServicioPublicas = pgView("solicitudes_servicio_publicas", {	id: uuid(),
	codigo: text(),
	grupo: text(),
	detalle: text(),
	municipio: text(),
	zonaId: uuid("zona_id"),
	zonaNombre: text("zona_nombre"),
	zonaTexto: text("zona_texto"),
	urgencia: text(),
	capacidadPago: text("capacidad_pago"),
	nota: text(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }),
	expiraAt: timestamp("expira_at", { withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	numRespuestas: bigint("num_respuestas", { mode: "number" }),
}).as(sql`SELECT s.id, s.codigo, s.grupo, s.detalle, s.municipio, s.zona_id, z.nombre AS zona_nombre, s.zona_texto, s.urgencia, s.capacidad_pago, s.nota, s.creada_at, s.expira_at, ( SELECT count(*) AS count FROM respuestas_servicio rs WHERE rs.solicitud_id = s.id) AS num_respuestas FROM solicitudes_servicio s LEFT JOIN zonas z ON z.id = s.zona_id WHERE s.estado = 'abierta'::text AND s.expira_at > now()`);

export const municipiosConServidores = pgView("municipios_con_servidores", {	codigoDane: text("codigo_dane"),
	nombre: text(),
	departamento: text(),
}).as(sql`SELECT DISTINCT m.codigo_dane, m.nombre, m.departamento FROM municipios m JOIN perfiles p ON m.codigo_dane = ANY (p.municipios) WHERE p.tipo = 'servidor'::text AND p.suspendido = false AND p.acepto_publicacion = true`);

export const servidoresPublicos = pgView("servidores_publicos", {	id: uuid(),
	nombreVisible: text("nombre_visible"),
	municipios: text().array(),
	contactoPublico: text("contacto_publico"),
	contactoTipo: text("contacto_tipo"),
	descripcion: text(),
	profesion: text(),
	entidadMatricula: text("entidad_matricula"),
	numeroMatricula: text("numero_matricula"),
	verificado: boolean(),
	servicios: text().array(),
}).as(sql`SELECT p.id, p.nombre_visible, p.municipios, p.contacto_publico, p.contacto_tipo, p.descripcion, sv.profesion, sv.entidad_matricula, sv.numero_matricula, sv.verificado, sv.servicios FROM perfiles p JOIN servidores sv ON sv.perfil_id = p.id WHERE p.tipo = 'servidor'::text AND p.suspendido = false AND p.acepto_publicacion = true`);

export const municipiosConOfertadores = pgView("municipios_con_ofertadores", {	codigoDane: text("codigo_dane"),
	nombre: text(),
	departamento: text(),
}).as(sql`SELECT DISTINCT m.codigo_dane, m.nombre, m.departamento FROM municipios m JOIN perfiles p ON m.codigo_dane = ANY (p.municipios) WHERE p.suspendido = false AND p.acepto_publicacion = true AND (p.tipo = 'ofertador'::text OR (EXISTS ( SELECT 1 FROM ofrecimientos o WHERE o.perfil_id = p.id)))`);

export const municipiosConSolicitudes = pgView("municipios_con_solicitudes", {	codigoDane: text("codigo_dane"),
	nombre: text(),
	departamento: text(),
}).as(sql`SELECT DISTINCT m.codigo_dane, m.nombre, m.departamento FROM municipios m JOIN solicitudes s ON s.municipio = m.codigo_dane WHERE estado_activo(s.estado) AND s.expira_at > now()`);

export const ofertadoresPublicos = pgView("ofertadores_publicos", {	id: uuid(),
	nombreVisible: text("nombre_visible"),
	municipios: text().array(),
	descripcion: text(),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }),
	items: jsonb(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalItems: bigint("total_items", { mode: "number" }),
	puedeTrasladarse: boolean("puede_trasladarse"),
}).as(sql`SELECT id, nombre_visible, municipios, descripcion, creado_at, ( SELECT COALESCE(jsonb_agg(t.x ORDER BY (t.x ->> 'nombre'::text)), '[]'::jsonb) AS "coalesce" FROM ( SELECT jsonb_build_object('nombre', COALESCE(c.nombre, sg.nombre_propuesto), 'por_confirmar', o.sugerencia_id IS NOT NULL) AS x FROM ofrecimientos o LEFT JOIN catalogo_items c ON c.id = o.item_id LEFT JOIN sugerencias_item sg ON sg.id = o.sugerencia_id WHERE o.perfil_id = p.id AND o.disponible ORDER BY (COALESCE(c.orden, 9999)) LIMIT 12) t) AS items, ( SELECT count(*) AS count FROM ofrecimientos o WHERE o.perfil_id = p.id AND o.disponible) AS total_items, puede_trasladarse FROM perfiles p WHERE suspendido = false AND acepto_publicacion = true AND (tipo = 'ofertador'::text OR (EXISTS ( SELECT 1 FROM ofrecimientos o WHERE o.perfil_id = p.id)))`);

export const proveedorOficiosPublicos = pgView("proveedor_oficios_publicos", {	proveedorId: uuid("proveedor_id"),
	oficioId: text("oficio_id"),
	modo: text(),
	precioDesde: numeric("precio_desde", { precision: 10, scale:  0 }),
	unidad: text(),
	oficioNombre: text("oficio_nombre"),
	grupo: text(),
	riesgo: text(),
}).as(sql`SELECT po.proveedor_id, po.oficio_id, po.modo, po.precio_desde, po.unidad, o.nombre AS oficio_nombre, o.grupo, o.riesgo FROM proveedor_oficios po JOIN catalogo_oficios o ON o.id = po.oficio_id JOIN proveedores p ON p.id = po.proveedor_id WHERE o.activo AND NOT p.suspendido AND p.acepto_publicacion AND (o.riesgo = 'bajo'::text OR p.telefono_verificado AND (EXISTS ( SELECT 1 FROM referencias r WHERE r.proveedor_id = p.id AND r.estado = 'confirmada'::text)))`);

export const resenasPublicas = pgView("resenas_publicas", {	id: uuid(),
	proveedorId: uuid("proveedor_id"),
	cumplimiento: smallint(),
	trato: smallint(),
	puntualidad: smallint(),
	comentario: text(),
	replica: text(),
	replicaAt: timestamp("replica_at", { withTimezone: true, mode: 'string' }),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }),
}).as(sql`SELECT r.id, r.proveedor_id, r.cumplimiento, r.trato, r.puntualidad, r.comentario, r.replica, r.replica_at, r.creada_at FROM resenas r JOIN proveedores p ON p.id = r.proveedor_id WHERE NOT r.oculta AND NOT p.suspendido AND p.acepto_publicacion`);

export const datosServicios = pgView("datos_servicios", {	municipio: text(),
	grupo: text(),
	oficio: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	solicitudes: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	conRespuesta: bigint("con_respuesta", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	resueltas: bigint({ mode: "number" }),
	horasPromedio: numeric("horas_promedio"),
}).as(sql`SELECT municipio, grupo, oficio, count(*) AS solicitudes, count(*) FILTER (WHERE hubo_respuesta) AS con_respuesta, count(*) FILTER (WHERE hubo_confirmacion) AS resueltas, round(avg(horas_hasta_respuesta), 1) AS horas_promedio FROM metricas_servicio m WHERE NOT es_prueba GROUP BY municipio, grupo, oficio`);

export const municipiosConProveedores = pgView("municipios_con_proveedores", {	codigoDane: text("codigo_dane"),
	nombre: text(),
	departamento: text(),
}).as(sql`SELECT DISTINCT m.codigo_dane, m.nombre, m.departamento FROM municipios m JOIN proveedores_publicos p ON p.municipio = m.codigo_dane`);

export const oficiosConProveedores = pgView("oficios_con_proveedores", {	id: text(),
	nombre: text(),
	grupo: text(),
	orden: integer(),
}).as(sql`SELECT DISTINCT o.id, o.nombre, o.grupo, o.orden FROM catalogo_oficios o JOIN proveedor_oficios_publicos pop ON pop.oficio_id = o.id`);

export const proveedoresPublicos = pgView("proveedores_publicos", {	id: uuid(),
	nombreVisible: text("nombre_visible"),
	tipo: text(),
	telefono: text(),
	telefonoVerificado: boolean("telefono_verificado"),
	municipio: text(),
	zonaId: uuid("zona_id"),
	zonaNombre: text("zona_nombre"),
	zonaTexto: text("zona_texto"),
	modalidad: text().array(),
	dias: text().array(),
	franjas: text().array(),
	mediosPago: text("medios_pago").array(),
	descripcion: text(),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }),
	latitud: numeric(),
	longitud: numeric(),
	oficios: text().array(),
	grupos: text().array(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	referenciasConfirmadas: bigint("referencias_confirmadas", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	serviciosConfirmados: bigint("servicios_confirmados", { mode: "number" }),
	cumplimiento: numeric(),
	trato: numeric(),
	puntualidad: numeric(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalResenas: bigint("total_resenas", { mode: "number" }),
	modos: text().array(),
	foto: text(),
}).as(sql`SELECT p.id, p.nombre_visible, p.tipo, p.telefono, p.telefono_verificado, p.municipio, p.zona_id, z.nombre AS zona_nombre, p.zona_texto, p.modalidad, p.dias, p.franjas, p.medios_pago, p.descripcion, p.creado_at, CASE WHEN p.acepto_mapa THEN p.latitud ELSE NULL::numeric END AS latitud, CASE WHEN p.acepto_mapa THEN p.longitud ELSE NULL::numeric END AS longitud, COALESCE(ofi.oficios, '{}'::text[]) AS oficios, COALESCE(ofi.grupos, '{}'::text[]) AS grupos, COALESCE(ref.confirmadas, 0::bigint) AS referencias_confirmadas, COALESCE(sp.confirmados, 0::bigint) AS servicios_confirmados, res.cumplimiento, res.trato, res.puntualidad, COALESCE(res.total, 0::bigint) AS total_resenas, COALESCE(ofi.modos, '{}'::text[]) AS modos, CASE WHEN p.acepto_foto THEN ( SELECT i.ruta FROM imagenes i WHERE i.objeto_tipo = 'proveedor'::text AND i.objeto_id = p.id AND i.estado = 'aprobada'::text ORDER BY i.subida_at LIMIT 1) ELSE NULL::text END AS foto FROM proveedores p LEFT JOIN zonas z ON z.id = p.zona_id JOIN LATERAL ( SELECT array_agg(DISTINCT pop.oficio_id) AS oficios, array_agg(DISTINCT pop.grupo) AS grupos, array_agg(DISTINCT pop.modo) AS modos FROM proveedor_oficios_publicos pop WHERE pop.proveedor_id = p.id) ofi ON ofi.oficios IS NOT NULL LEFT JOIN LATERAL ( SELECT count(*) AS confirmadas FROM referencias r WHERE r.proveedor_id = p.id AND r.estado = 'confirmada'::text) ref ON true LEFT JOIN LATERAL ( SELECT count(*) AS confirmados FROM servicios_prestados s WHERE s.proveedor_id = p.id AND s.confirmado_at IS NOT NULL) sp ON true LEFT JOIN LATERAL ( SELECT count(*) AS total, round(avg(r.cumplimiento), 1) AS cumplimiento, round(avg(r.trato), 1) AS trato, round(avg(r.puntualidad), 1) AS puntualidad FROM resenas r WHERE r.proveedor_id = p.id AND NOT r.oculta) res ON true WHERE NOT p.suspendido AND p.acepto_publicacion AND p.telefono_verificado`);

export const vCruces = pgView("v_cruces", {	solicitudId: uuid("solicitud_id"),
	codigo: text(),
	municipio: text(),
	ofertadorId: uuid("ofertador_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	itemsCoincidentes: bigint("items_coincidentes", { mode: "number" }),
	detalle: jsonb(),
}).as(sql`SELECT s.id AS solicitud_id, s.codigo, s.municipio, o.id AS ofertador_id, count(*) AS items_coincidentes, jsonb_agg(jsonb_build_object('nombre', COALESCE(c.nombre, sg.nombre_propuesto), 'cantidad', si.cantidad, 'unidad', COALESCE(c.unidad, sg.unidad_sugerida, 'unidad'::text)) ORDER BY (COALESCE(c.orden, 9999))) AS detalle FROM solicitud_items si JOIN solicitudes s ON s.id = si.solicitud_id JOIN ofrecimientos ofr ON ofr.item_id IS NOT NULL AND ofr.item_id = si.item_id OR ofr.sugerencia_id IS NOT NULL AND ofr.sugerencia_id = si.sugerencia_id JOIN perfiles o ON o.id = ofr.perfil_id LEFT JOIN catalogo_items c ON c.id = si.item_id LEFT JOIN sugerencias_item sg ON sg.id = si.sugerencia_id WHERE si.cubierto = false AND ofr.disponible = true AND estado_activo(s.estado) AND s.expira_at > now() AND (s.municipio = ANY (o.municipios)) AND puede_ofrecer(o.id) GROUP BY s.id, s.codigo, s.municipio, o.id`);

export const acopiosPublicos = pgView("acopios_publicos", {	id: uuid(),
	nombre: text(),
	tipo: text(),
	slug: text(),
	municipios: text().array(),
	direccionAcopio: text("direccion_acopio"),
	horarioAcopio: text("horario_acopio"),
	telefono: text(),
	latitud: numeric({ precision: 9, scale:  6 }),
	longitud: numeric({ precision: 9, scale:  6 }),
}).as(sql`SELECT id, nombre, tipo, slug, municipios, direccion_acopio, horario_acopio, telefono, latitud, longitud FROM organizaciones o WHERE activa`);

export const productosPublicos = pgView("productos_publicos", {	id: uuid(),
	proveedorId: uuid("proveedor_id"),
	proveedorNombre: text("proveedor_nombre"),
	municipio: text(),
	zonaNombre: text("zona_nombre"),
	nombre: text(),
	detalle: text(),
	modo: text(),
	precioDesde: numeric("precio_desde", { precision: 12, scale:  2 }),
	unidad: text(),
	creadoAt: timestamp("creado_at", { withTimezone: true, mode: 'string' }),
	imagen: text(),
	telefono: text(),
	telefonoVerificado: boolean("telefono_verificado"),
	grupos: text().array(),
}).as(sql`SELECT p.id, p.proveedor_id, pp.nombre_visible AS proveedor_nombre, pp.municipio, pp.zona_nombre, p.nombre, p.detalle, p.modo, p.precio_desde, p.unidad, p.creado_at, ( SELECT i.ruta FROM imagenes i WHERE i.objeto_tipo = 'producto'::text AND i.objeto_id = p.id AND i.estado = 'aprobada'::text ORDER BY i.subida_at LIMIT 1) AS imagen, pp.telefono, pp.telefono_verificado, pp.grupos FROM productos p JOIN proveedores_publicos pp ON pp.id = p.proveedor_id WHERE p.disponible`);

export const muroPublico = pgView("muro_publico", {	id: uuid(),
	cara: text(),
	categoria: text(),
	titulo: text(),
	detalle: text(),
	municipio: text(),
	municipioNombre: text("municipio_nombre"),
	zonaId: uuid("zona_id"),
	zonaNombre: text("zona_nombre"),
	autorNombre: text("autor_nombre"),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }),
	imagen: text(),
	proveedorId: uuid("proveedor_id"),
	telefono: text(),
	telefonoVerificado: boolean("telefono_verificado"),
	acopioNombre: text("acopio_nombre"),
	acopioDireccion: text("acopio_direccion"),
}).as(sql`SELECT m.id, m.cara, m.categoria, m.titulo, m.detalle, m.municipio, mu.nombre AS municipio_nombre, m.zona_id, z.nombre AS zona_nombre, m.autor_nombre, m.creada_at, ( SELECT i.ruta FROM imagenes i WHERE i.objeto_tipo = 'muro'::text AND i.objeto_id = m.id AND i.estado = 'aprobada'::text ORDER BY i.subida_at LIMIT 1) AS imagen, pp.id AS proveedor_id, pp.telefono, COALESCE(pp.telefono_verificado, false) AS telefono_verificado, ac.nombre AS acopio_nombre, ac.direccion_acopio AS acopio_direccion FROM publicaciones_muro m JOIN municipios mu ON mu.codigo_dane = m.municipio LEFT JOIN zonas z ON z.id = m.zona_id LEFT JOIN proveedores pr ON pr.perfil_id = m.perfil_id LEFT JOIN proveedores_publicos pp ON pp.id = pr.id LEFT JOIN acopios_publicos ac ON ac.id = m.acopio_id WHERE m.estado = 'abierta'::text AND (m.expira_at IS NULL OR m.expira_at > now())`);

export const solicitudesPublicas = pgView("solicitudes_publicas", {	id: uuid(),
	codigo: text(),
	municipio: text(),
	municipioNombre: text("municipio_nombre"),
	barrio: text(),
	categoria: text(),
	nota: text(),
	creadaAt: timestamp("creada_at", { withTimezone: true, mode: 'string' }),
	confirmadaAt: timestamp("confirmada_at", { withTimezone: true, mode: 'string' }),
	expiraAt: timestamp("expira_at", { withTimezone: true, mode: 'string' }),
	horasSinConfirmar: numeric("horas_sin_confirmar"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	numRespuestas: bigint("num_respuestas", { mode: "number" }),
	items: jsonb(),
	itemIds: text("item_ids").array(),
	sugerenciaIds: uuid("sugerencia_ids").array(),
	notaAdmin: text("nota_admin"),
}).as(sql`SELECT s.id, s.codigo, s.municipio, (m.nombre || ', '::text) || m.departamento AS municipio_nombre, s.barrio, s.categoria, s.nota, s.creada_at, s.confirmada_at, s.expira_at, EXTRACT(epoch FROM now() - s.confirmada_at) / 3600::numeric AS horas_sin_confirmar, ( SELECT count(*) AS count FROM respuestas r WHERE r.solicitud_id = s.id) AS num_respuestas, ( SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', COALESCE(c.nombre, sg.nombre_propuesto), 'cantidad', si.cantidad, 'unidad', COALESCE(c.unidad, sg.unidad_sugerida, 'unidad'::text), 'por_confirmar', si.sugerencia_id IS NOT NULL) ORDER BY (COALESCE(c.orden, 9999))), '[]'::jsonb) AS "coalesce" FROM solicitud_items si LEFT JOIN catalogo_items c ON c.id = si.item_id LEFT JOIN sugerencias_item sg ON sg.id = si.sugerencia_id WHERE si.solicitud_id = s.id) AS items, ( SELECT COALESCE(array_agg(si.item_id) FILTER (WHERE si.item_id IS NOT NULL), '{}'::text[]) AS "coalesce" FROM solicitud_items si WHERE si.solicitud_id = s.id) AS item_ids, ( SELECT COALESCE(array_agg(si.sugerencia_id) FILTER (WHERE si.sugerencia_id IS NOT NULL), '{}'::uuid[]) AS "coalesce" FROM solicitud_items si WHERE si.solicitud_id = s.id) AS sugerencia_ids, s.nota_admin FROM solicitudes s JOIN municipios m ON m.codigo_dane = s.municipio WHERE estado_activo(s.estado) AND s.expira_at > now()`);