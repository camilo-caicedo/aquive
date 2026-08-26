import { relations } from "drizzle-orm/relations";
import { catalogoItems, ofrecimientos, perfiles, sugerenciasItem, conversaciones, entregas, organizaciones, entidades, solicitudes, solicitudesContacto, municipios, zonas, invitacionesOrganizacion, identidades, accesosIdentidad, mensajes, servidores, administradores, pushSuscripciones, pushOfertadores, solicitudItems, respuestas, catalogoOficios, referencias, proveedores, accesosReferencia, respuestasServicio, solicitudesServicio, serviciosPrestados, resenas, chatsServicio, mensajesServicio, imagenes, publicacionesMuro, productos, destapesContacto, proveedorOficios, miembrosOrganizacion } from "./schema";
import { usersInAuth } from "../tipos";

export const ofrecimientosRelations = relations(ofrecimientos, ({one}) => ({
	catalogoItem: one(catalogoItems, {
		fields: [ofrecimientos.itemId],
		references: [catalogoItems.id]
	}),
	perfile: one(perfiles, {
		fields: [ofrecimientos.perfilId],
		references: [perfiles.id]
	}),
	sugerenciasItem: one(sugerenciasItem, {
		fields: [ofrecimientos.sugerenciaId],
		references: [sugerenciasItem.id]
	}),
}));

export const catalogoItemsRelations = relations(catalogoItems, ({one, many}) => ({
	ofrecimientos: many(ofrecimientos),
	entregases: many(entregas),
	sugerenciasItems: many(sugerenciasItem),
	usersInAuth: one(usersInAuth, {
		fields: [catalogoItems.creadoPor],
		references: [usersInAuth.id]
	}),
	solicitudItems: many(solicitudItems),
}));

export const perfilesRelations = relations(perfiles, ({one, many}) => ({
	ofrecimientos: many(ofrecimientos),
	invitacionesOrganizacions: many(invitacionesOrganizacion),
	identidades: many(identidades),
	mensajes: many(mensajes),
	conversaciones_aliadoId: many(conversaciones, {
		relationName: "conversaciones_aliadoId_perfiles_id"
	}),
	conversaciones_ofertadorId: many(conversaciones, {
		relationName: "conversaciones_ofertadorId_perfiles_id"
	}),
	servidores: many(servidores),
	pushOfertadores: many(pushOfertadores),
	usersInAuth: one(usersInAuth, {
		fields: [perfiles.id],
		references: [usersInAuth.id]
	}),
	respuestas: many(respuestas),
	proveedores: many(proveedores),
	publicacionesMuros: many(publicacionesMuro),
	destapesContactos: many(destapesContacto),
	miembrosOrganizacions_aprobadoPor: many(miembrosOrganizacion, {
		relationName: "miembrosOrganizacion_aprobadoPor_perfiles_id"
	}),
	miembrosOrganizacions_perfilId: many(miembrosOrganizacion, {
		relationName: "miembrosOrganizacion_perfilId_perfiles_id"
	}),
	miembrosOrganizacions_permisoIdentidadPor: many(miembrosOrganizacion, {
		relationName: "miembrosOrganizacion_permisoIdentidadPor_perfiles_id"
	}),
}));

export const sugerenciasItemRelations = relations(sugerenciasItem, ({one, many}) => ({
	ofrecimientos: many(ofrecimientos),
	entregases: many(entregas),
	catalogoItem: one(catalogoItems, {
		fields: [sugerenciasItem.itemResultanteId],
		references: [catalogoItems.id]
	}),
	usersInAuth_propuestaPor: one(usersInAuth, {
		fields: [sugerenciasItem.propuestaPor],
		references: [usersInAuth.id],
		relationName: "sugerenciasItem_propuestaPor_usersInAuth_id"
	}),
	usersInAuth_revisadaPor: one(usersInAuth, {
		fields: [sugerenciasItem.revisadaPor],
		references: [usersInAuth.id],
		relationName: "sugerenciasItem_revisadaPor_usersInAuth_id"
	}),
	solicitudItems: many(solicitudItems),
}));

export const entregasRelations = relations(entregas, ({one}) => ({
	conversacione: one(conversaciones, {
		fields: [entregas.conversacionId],
		references: [conversaciones.id]
	}),
	catalogoItem: one(catalogoItems, {
		fields: [entregas.itemId],
		references: [catalogoItems.id]
	}),
	organizacione: one(organizaciones, {
		fields: [entregas.organizacionId],
		references: [organizaciones.id]
	}),
	sugerenciasItem: one(sugerenciasItem, {
		fields: [entregas.sugerenciaId],
		references: [sugerenciasItem.id]
	}),
}));

export const conversacionesRelations = relations(conversaciones, ({one, many}) => ({
	entregases: many(entregas),
	mensajes: many(mensajes),
	perfile_aliadoId: one(perfiles, {
		fields: [conversaciones.aliadoId],
		references: [perfiles.id],
		relationName: "conversaciones_aliadoId_perfiles_id"
	}),
	perfile_ofertadorId: one(perfiles, {
		fields: [conversaciones.ofertadorId],
		references: [perfiles.id],
		relationName: "conversaciones_ofertadorId_perfiles_id"
	}),
	organizacione: one(organizaciones, {
		fields: [conversaciones.organizacionId],
		references: [organizaciones.id]
	}),
	solicitude: one(solicitudes, {
		fields: [conversaciones.solicitudId],
		references: [solicitudes.id]
	}),
}));

export const organizacionesRelations = relations(organizaciones, ({one, many}) => ({
	entregases: many(entregas),
	usersInAuth: one(usersInAuth, {
		fields: [organizaciones.creadaPor],
		references: [usersInAuth.id]
	}),
	invitacionesOrganizacions: many(invitacionesOrganizacion),
	conversaciones: many(conversaciones),
	solicitudes: many(solicitudes),
	proveedores: many(proveedores),
	miembrosOrganizacions: many(miembrosOrganizacion),
}));

export const entidadesRelations = relations(entidades, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [entidades.creadaPor],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	entidades: many(entidades),
	zonas: many(zonas),
	sugerenciasItems_propuestaPor: many(sugerenciasItem, {
		relationName: "sugerenciasItem_propuestaPor_usersInAuth_id"
	}),
	sugerenciasItems_revisadaPor: many(sugerenciasItem, {
		relationName: "sugerenciasItem_revisadaPor_usersInAuth_id"
	}),
	organizaciones: many(organizaciones),
	accesosIdentidads: many(accesosIdentidad),
	mensajes: many(mensajes),
	servidores: many(servidores),
	administradores: many(administradores),
	solicitudes: many(solicitudes),
	catalogoItems: many(catalogoItems),
	perfiles: many(perfiles),
	referencias: many(referencias),
	accesosReferencias: many(accesosReferencia),
	proveedores: many(proveedores),
	imagenes: many(imagenes),
}));

export const solicitudesContactoRelations = relations(solicitudesContacto, ({one}) => ({
	solicitude: one(solicitudes, {
		fields: [solicitudesContacto.solicitudId],
		references: [solicitudes.id]
	}),
}));

export const solicitudesRelations = relations(solicitudes, ({one, many}) => ({
	solicitudesContactos: many(solicitudesContacto),
	identidades: many(identidades),
	conversaciones: many(conversaciones),
	municipio: one(municipios, {
		fields: [solicitudes.municipio],
		references: [municipios.codigoDane]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [solicitudes.notaAdminPor],
		references: [usersInAuth.id]
	}),
	organizacione: one(organizaciones, {
		fields: [solicitudes.organizacionId],
		references: [organizaciones.id]
	}),
	pushSuscripciones: many(pushSuscripciones),
	solicitudItems: many(solicitudItems),
	respuestas: many(respuestas),
	destapesContactos: many(destapesContacto),
}));

export const zonasRelations = relations(zonas, ({one, many}) => ({
	municipio: one(municipios, {
		fields: [zonas.municipio],
		references: [municipios.codigoDane]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [zonas.revisadaPor],
		references: [usersInAuth.id]
	}),
	proveedores: many(proveedores),
	solicitudesServicios: many(solicitudesServicio),
	publicacionesMuros: many(publicacionesMuro),
}));

export const municipiosRelations = relations(municipios, ({many}) => ({
	zonas: many(zonas),
	solicitudes: many(solicitudes),
	proveedores: many(proveedores),
	solicitudesServicios: many(solicitudesServicio),
	publicacionesMuros: many(publicacionesMuro),
}));

export const invitacionesOrganizacionRelations = relations(invitacionesOrganizacion, ({one, many}) => ({
	perfile: one(perfiles, {
		fields: [invitacionesOrganizacion.creadaPor],
		references: [perfiles.id]
	}),
	organizacione: one(organizaciones, {
		fields: [invitacionesOrganizacion.organizacionId],
		references: [organizaciones.id]
	}),
	miembrosOrganizacions: many(miembrosOrganizacion),
}));

export const identidadesRelations = relations(identidades, ({one, many}) => ({
	perfile: one(perfiles, {
		fields: [identidades.perfilId],
		references: [perfiles.id]
	}),
	solicitude: one(solicitudes, {
		fields: [identidades.solicitudId],
		references: [solicitudes.id]
	}),
	accesosIdentidads: many(accesosIdentidad),
}));

export const accesosIdentidadRelations = relations(accesosIdentidad, ({one}) => ({
	identidade: one(identidades, {
		fields: [accesosIdentidad.identidadId],
		references: [identidades.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [accesosIdentidad.leidaPor],
		references: [usersInAuth.id]
	}),
}));

export const mensajesRelations = relations(mensajes, ({one}) => ({
	perfile: one(perfiles, {
		fields: [mensajes.autorPerfilId],
		references: [perfiles.id]
	}),
	conversacione: one(conversaciones, {
		fields: [mensajes.conversacionId],
		references: [conversaciones.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [mensajes.ocultoPor],
		references: [usersInAuth.id]
	}),
}));

export const servidoresRelations = relations(servidores, ({one}) => ({
	perfile: one(perfiles, {
		fields: [servidores.perfilId],
		references: [perfiles.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [servidores.verificadoPor],
		references: [usersInAuth.id]
	}),
}));

export const administradoresRelations = relations(administradores, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [administradores.userId],
		references: [usersInAuth.id]
	}),
}));

export const pushSuscripcionesRelations = relations(pushSuscripciones, ({one}) => ({
	solicitude: one(solicitudes, {
		fields: [pushSuscripciones.solicitudId],
		references: [solicitudes.id]
	}),
}));

export const pushOfertadoresRelations = relations(pushOfertadores, ({one}) => ({
	perfile: one(perfiles, {
		fields: [pushOfertadores.perfilId],
		references: [perfiles.id]
	}),
}));

export const solicitudItemsRelations = relations(solicitudItems, ({one}) => ({
	catalogoItem: one(catalogoItems, {
		fields: [solicitudItems.itemId],
		references: [catalogoItems.id]
	}),
	solicitude: one(solicitudes, {
		fields: [solicitudItems.solicitudId],
		references: [solicitudes.id]
	}),
	sugerenciasItem: one(sugerenciasItem, {
		fields: [solicitudItems.sugerenciaId],
		references: [sugerenciasItem.id]
	}),
}));

export const respuestasRelations = relations(respuestas, ({one}) => ({
	perfile: one(perfiles, {
		fields: [respuestas.autorId],
		references: [perfiles.id]
	}),
	solicitude: one(solicitudes, {
		fields: [respuestas.solicitudId],
		references: [solicitudes.id]
	}),
}));

export const referenciasRelations = relations(referencias, ({one, many}) => ({
	catalogoOficio: one(catalogoOficios, {
		fields: [referencias.oficioId],
		references: [catalogoOficios.id]
	}),
	proveedore: one(proveedores, {
		fields: [referencias.proveedorId],
		references: [proveedores.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [referencias.revisadaPor],
		references: [usersInAuth.id]
	}),
	accesosReferencias: many(accesosReferencia),
}));

export const catalogoOficiosRelations = relations(catalogoOficios, ({many}) => ({
	referencias: many(referencias),
	serviciosPrestados: many(serviciosPrestados),
	solicitudesServicios: many(solicitudesServicio),
	proveedorOficios: many(proveedorOficios),
}));

export const proveedoresRelations = relations(proveedores, ({one, many}) => ({
	referencias: many(referencias),
	respuestasServicios: many(respuestasServicio),
	serviciosPrestados: many(serviciosPrestados),
	resenas: many(resenas),
	municipio: one(municipios, {
		fields: [proveedores.municipio],
		references: [municipios.codigoDane]
	}),
	organizacione: one(organizaciones, {
		fields: [proveedores.organizacionId],
		references: [organizaciones.id]
	}),
	perfile: one(perfiles, {
		fields: [proveedores.perfilId],
		references: [perfiles.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [proveedores.verificadoPor],
		references: [usersInAuth.id]
	}),
	zona: one(zonas, {
		fields: [proveedores.zonaId],
		references: [zonas.id]
	}),
	productos: many(productos),
	proveedorOficios: many(proveedorOficios),
}));

export const accesosReferenciaRelations = relations(accesosReferencia, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [accesosReferencia.leidaPor],
		references: [usersInAuth.id]
	}),
	referencia: one(referencias, {
		fields: [accesosReferencia.referenciaId],
		references: [referencias.id]
	}),
}));

export const respuestasServicioRelations = relations(respuestasServicio, ({one, many}) => ({
	proveedore: one(proveedores, {
		fields: [respuestasServicio.proveedorId],
		references: [proveedores.id]
	}),
	solicitudesServicio: one(solicitudesServicio, {
		fields: [respuestasServicio.solicitudId],
		references: [solicitudesServicio.id]
	}),
	chatsServicios: many(chatsServicio),
}));

export const solicitudesServicioRelations = relations(solicitudesServicio, ({one, many}) => ({
	respuestasServicios: many(respuestasServicio),
	municipio: one(municipios, {
		fields: [solicitudesServicio.municipio],
		references: [municipios.codigoDane]
	}),
	catalogoOficio: one(catalogoOficios, {
		fields: [solicitudesServicio.oficioId],
		references: [catalogoOficios.id]
	}),
	zona: one(zonas, {
		fields: [solicitudesServicio.zonaId],
		references: [zonas.id]
	}),
}));

export const serviciosPrestadosRelations = relations(serviciosPrestados, ({one, many}) => ({
	catalogoOficio: one(catalogoOficios, {
		fields: [serviciosPrestados.oficioId],
		references: [catalogoOficios.id]
	}),
	proveedore: one(proveedores, {
		fields: [serviciosPrestados.proveedorId],
		references: [proveedores.id]
	}),
	resenas: many(resenas),
}));

export const resenasRelations = relations(resenas, ({one}) => ({
	proveedore: one(proveedores, {
		fields: [resenas.proveedorId],
		references: [proveedores.id]
	}),
	serviciosPrestado: one(serviciosPrestados, {
		fields: [resenas.servicioId],
		references: [serviciosPrestados.id]
	}),
}));

export const chatsServicioRelations = relations(chatsServicio, ({one, many}) => ({
	respuestasServicio: one(respuestasServicio, {
		fields: [chatsServicio.respuestaId],
		references: [respuestasServicio.id]
	}),
	mensajesServicios: many(mensajesServicio),
}));

export const mensajesServicioRelations = relations(mensajesServicio, ({one}) => ({
	chatsServicio: one(chatsServicio, {
		fields: [mensajesServicio.chatId],
		references: [chatsServicio.id]
	}),
}));

export const imagenesRelations = relations(imagenes, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [imagenes.revisadaPor],
		references: [usersInAuth.id]
	}),
}));

export const publicacionesMuroRelations = relations(publicacionesMuro, ({one}) => ({
	municipio: one(municipios, {
		fields: [publicacionesMuro.municipio],
		references: [municipios.codigoDane]
	}),
	perfile: one(perfiles, {
		fields: [publicacionesMuro.perfilId],
		references: [perfiles.id]
	}),
	zona: one(zonas, {
		fields: [publicacionesMuro.zonaId],
		references: [zonas.id]
	}),
}));

export const productosRelations = relations(productos, ({one}) => ({
	proveedore: one(proveedores, {
		fields: [productos.proveedorId],
		references: [proveedores.id]
	}),
}));

export const destapesContactoRelations = relations(destapesContacto, ({one}) => ({
	perfile: one(perfiles, {
		fields: [destapesContacto.perfilId],
		references: [perfiles.id]
	}),
	solicitude: one(solicitudes, {
		fields: [destapesContacto.solicitudId],
		references: [solicitudes.id]
	}),
}));

export const proveedorOficiosRelations = relations(proveedorOficios, ({one}) => ({
	catalogoOficio: one(catalogoOficios, {
		fields: [proveedorOficios.oficioId],
		references: [catalogoOficios.id]
	}),
	proveedore: one(proveedores, {
		fields: [proveedorOficios.proveedorId],
		references: [proveedores.id]
	}),
}));

export const miembrosOrganizacionRelations = relations(miembrosOrganizacion, ({one}) => ({
	perfile_aprobadoPor: one(perfiles, {
		fields: [miembrosOrganizacion.aprobadoPor],
		references: [perfiles.id],
		relationName: "miembrosOrganizacion_aprobadoPor_perfiles_id"
	}),
	invitacionesOrganizacion: one(invitacionesOrganizacion, {
		fields: [miembrosOrganizacion.invitacionId],
		references: [invitacionesOrganizacion.id]
	}),
	organizacione: one(organizaciones, {
		fields: [miembrosOrganizacion.organizacionId],
		references: [organizaciones.id]
	}),
	perfile_perfilId: one(perfiles, {
		fields: [miembrosOrganizacion.perfilId],
		references: [perfiles.id],
		relationName: "miembrosOrganizacion_perfilId_perfiles_id"
	}),
	perfile_permisoIdentidadPor: one(perfiles, {
		fields: [miembrosOrganizacion.permisoIdentidadPor],
		references: [perfiles.id],
		relationName: "miembrosOrganizacion_permisoIdentidadPor_perfiles_id"
	}),
}));