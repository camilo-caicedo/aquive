import { relations } from "drizzle-orm/relations";
import { chats, mensajes, catalogoItems, entregas, organizaciones, sugerenciasItem, entidades, municipios, zonas, catalogoOficios, perfiles, invitacionesOrganizacion, servidores, administradores, referencias, proveedores, accesosReferencia, solicitudesServicio, serviciosPrestados, resenas, productos, publicacionesMuro, imagenes, codigosAcceso, pushOfertadores, proveedorOficios, proveedorOficiosSugeridos, miembrosOrganizacion } from "./schema";
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
	solicitudesServicio: one(solicitudesServicio, {
		fields: [chats.solicitudServicioId],
		references: [solicitudesServicio.id]
	}),
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

export const catalogoItemsRelations = relations(catalogoItems, ({one, many}) => ({
	entregases: many(entregas),
	sugerenciasItems: many(sugerenciasItem),
	usersInAuth: one(usersInAuth, {
		fields: [catalogoItems.creadoPor],
		references: [usersInAuth.id]
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

export const sugerenciasItemRelations = relations(sugerenciasItem, ({one, many}) => ({
	entregases: many(entregas),
	catalogoItem: one(catalogoItems, {
		fields: [sugerenciasItem.itemResultanteId],
		references: [catalogoItems.id]
	}),
	catalogoOficio: one(catalogoOficios, {
		fields: [sugerenciasItem.oficioResultanteId],
		references: [catalogoOficios.id]
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
	solicitudesServicios: many(solicitudesServicio),
	proveedorOficiosSugeridos: many(proveedorOficiosSugeridos),
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
	perfiles: many(perfiles),
	catalogoItems: many(catalogoItems),
	referencias: many(referencias),
	accesosReferencias: many(accesosReferencia),
	proveedores: many(proveedores),
	imagenes: many(imagenes),
	codigosAccesos: many(codigosAcceso),
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
	solicitudesServicios: many(solicitudesServicio),
	proveedores: many(proveedores),
	publicacionesMuros: many(publicacionesMuro),
}));

export const municipiosRelations = relations(municipios, ({many}) => ({
	zonas: many(zonas),
	solicitudesServicios: many(solicitudesServicio),
	proveedores: many(proveedores),
	publicacionesMuros: many(publicacionesMuro),
}));

export const catalogoOficiosRelations = relations(catalogoOficios, ({many}) => ({
	sugerenciasItems: many(sugerenciasItem),
	referencias: many(referencias),
	solicitudesServicios: many(solicitudesServicio),
	serviciosPrestados: many(serviciosPrestados),
	proveedorOficios: many(proveedorOficios),
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

export const perfilesRelations = relations(perfiles, ({one, many}) => ({
	invitacionesOrganizacions: many(invitacionesOrganizacion),
	servidores: many(servidores),
	usersInAuth: one(usersInAuth, {
		fields: [perfiles.id],
		references: [usersInAuth.id]
	}),
	solicitudesServicios: many(solicitudesServicio),
	proveedores: many(proveedores),
	chats: many(chats),
	publicacionesMuros: many(publicacionesMuro),
	codigosAccesos: many(codigosAcceso),
	pushOfertadores: many(pushOfertadores),
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

export const proveedoresRelations = relations(proveedores, ({one, many}) => ({
	referencias: many(referencias),
	solicitudesServicios: many(solicitudesServicio),
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
	proveedorOficiosSugeridos: many(proveedorOficiosSugeridos),
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

export const solicitudesServicioRelations = relations(solicitudesServicio, ({one, many}) => ({
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
	proveedore: one(proveedores, {
		fields: [solicitudesServicio.proveedorId],
		references: [proveedores.id]
	}),
	sugerenciasItem: one(sugerenciasItem, {
		fields: [solicitudesServicio.sugerenciaId],
		references: [sugerenciasItem.id]
	}),
	zona: one(zonas, {
		fields: [solicitudesServicio.zonaId],
		references: [zonas.id]
	}),
	chats: many(chats),
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

export const pushOfertadoresRelations = relations(pushOfertadores, ({one}) => ({
	perfile: one(perfiles, {
		fields: [pushOfertadores.perfilId],
		references: [perfiles.id]
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

export const proveedorOficiosSugeridosRelations = relations(proveedorOficiosSugeridos, ({one}) => ({
	proveedore: one(proveedores, {
		fields: [proveedorOficiosSugeridos.proveedorId],
		references: [proveedores.id]
	}),
	sugerenciasItem: one(sugerenciasItem, {
		fields: [proveedorOficiosSugeridos.sugerenciaId],
		references: [sugerenciasItem.id]
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