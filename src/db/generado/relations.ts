import { relations } from "drizzle-orm/relations";
import { chats, mensajes, catalogoItems, ofrecimientos, perfiles, sugerenciasItem, entregas, organizaciones, entidades, solicitudes, solicitudesContacto, municipios, zonas, invitacionesOrganizacion, servidores, administradores, pushSuscripciones, pushOfertadores, solicitudItems, respuestas, catalogoOficios, referencias, proveedores, accesosReferencia, respuestasServicio, solicitudesServicio, serviciosPrestados, resenas, productos, publicacionesMuro, imagenes, codigosAcceso, destapesContacto, proveedorOficios, miembrosOrganizacion } from "./schema";
import { usersInAuth } from "../tipos";

export const mensajesRelations = relations(mensajes, ({one}) => ({
	chat: one(chats, {
		fields: [mensajes.chatId],
		references: [chats.id]
	}),
}));

export const chatsRelations = relations(chats, ({one, many}) => ({
	mensajes: many(mensajes),
	perfile: one(perfiles, {
		fields: [chats.iniciadoPor],
		references: [perfiles.id]
	}),
	producto: one(productos, {
		fields: [chats.productoId],
		references: [productos.id]
	}),
	proveedore: one(proveedores, {
		fields: [chats.proveedorId],
		references: [proveedores.id]
	}),
	publicacionesMuro: one(publicacionesMuro, {
		fields: [chats.publicacionId],
		references: [publicacionesMuro.id]
	}),
	respuesta: one(respuestas, {
		fields: [chats.respuestaInsumoId],
		references: [respuestas.id]
	}),
	respuestasServicio: one(respuestasServicio, {
		fields: [chats.respuestaServicioId],
		references: [respuestasServicio.id]
	}),
}));

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
	servidores: many(servidores),
	pushOfertadores: many(pushOfertadores),
	usersInAuth: one(usersInAuth, {
		fields: [perfiles.id],
		references: [usersInAuth.id]
	}),
	respuestas: many(respuestas),
	solicitudes: many(solicitudes),
	proveedores: many(proveedores),
	solicitudesServicios: many(solicitudesServicio),
	chats: many(chats),
	publicacionesMuros: many(publicacionesMuro),
	codigosAccesos: many(codigosAcceso),
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

export const organizacionesRelations = relations(organizaciones, ({one, many}) => ({
	entregases: many(entregas),
	usersInAuth: one(usersInAuth, {
		fields: [organizaciones.creadaPor],
		references: [usersInAuth.id]
	}),
	invitacionesOrganizacions: many(invitacionesOrganizacion),
	proveedores: many(proveedores),
	publicacionesMuros: many(publicacionesMuro),
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
	servidores: many(servidores),
	administradores: many(administradores),
	catalogoItems: many(catalogoItems),
	perfiles: many(perfiles),
	solicitudes: many(solicitudes),
	referencias: many(referencias),
	accesosReferencias: many(accesosReferencia),
	proveedores: many(proveedores),
	imagenes: many(imagenes),
	codigosAccesos: many(codigosAcceso),
}));

export const solicitudesContactoRelations = relations(solicitudesContacto, ({one}) => ({
	solicitude: one(solicitudes, {
		fields: [solicitudesContacto.solicitudId],
		references: [solicitudes.id]
	}),
}));

export const solicitudesRelations = relations(solicitudes, ({one, many}) => ({
	solicitudesContactos: many(solicitudesContacto),
	pushSuscripciones: many(pushSuscripciones),
	solicitudItems: many(solicitudItems),
	respuestas: many(respuestas),
	municipio: one(municipios, {
		fields: [solicitudes.municipio],
		references: [municipios.codigoDane]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [solicitudes.notaAdminPor],
		references: [usersInAuth.id]
	}),
	perfile: one(perfiles, {
		fields: [solicitudes.perfilId],
		references: [perfiles.id]
	}),
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

export const respuestasRelations = relations(respuestas, ({one, many}) => ({
	perfile: one(perfiles, {
		fields: [respuestas.autorId],
		references: [perfiles.id]
	}),
	solicitude: one(solicitudes, {
		fields: [respuestas.solicitudId],
		references: [solicitudes.id]
	}),
	chats: many(chats),
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
	chats: many(chats),
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
	chats: many(chats),
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
	perfile: one(perfiles, {
		fields: [solicitudesServicio.perfilId],
		references: [perfiles.id]
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

export const productosRelations = relations(productos, ({one, many}) => ({
	chats: many(chats),
	proveedore: one(proveedores, {
		fields: [productos.proveedorId],
		references: [proveedores.id]
	}),
}));

export const publicacionesMuroRelations = relations(publicacionesMuro, ({one, many}) => ({
	chats: many(chats),
	organizacione: one(organizaciones, {
		fields: [publicacionesMuro.acopioId],
		references: [organizaciones.id]
	}),
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

export const imagenesRelations = relations(imagenes, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [imagenes.revisadaPor],
		references: [usersInAuth.id]
	}),
}));

export const codigosAccesoRelations = relations(codigosAcceso, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [codigosAcceso.creadoPor],
		references: [usersInAuth.id]
	}),
	perfile: one(perfiles, {
		fields: [codigosAcceso.perfilId],
		references: [perfiles.id]
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