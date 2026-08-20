// Aparece en el texto de autorización que firma cada ofertador y servidor
// (docs/legal/PLANTILLAS.md sección 3) y en las páginas legales, así que
// tiene efecto legal. Debe coincidir con lo que diga PLANTILLAS.md.
export const RESPONSABLE = 'Juan Camilo Caicedo Sepulveda'
export const CORREO_CONTACTO = 'soporte@aquive.co'
// Se mueve cada vez que cambia un texto legal, y no antes: es lo que se
// guarda en `identidades.autorizacion_version` y por tanto la prueba de
// QUÉ versión aceptó cada persona. Si el texto cambia y la fecha no, esa
// prueba deja de servir.
//
// 15/08/2026: el techo de la auto-renovación bajó de 14 días a 5, y los
// términos §7 lo dicen ahora.
//
// 19/08/2026: entra el módulo de Servicios. Cambian el aviso de privacidad
// (dos regímenes), los términos §3 (antes decían que nunca habría
// reputación) y §12 (alcance ampliado dentro de /servicios).
export const FECHA_LEGALES = '19 de agosto de 2026'

// El módulo de Servicios tiene OTRO responsable del tratamiento. Aquí la
// fundación decide para qué se usan los datos y AquíVe solo los guarda:
// es el reparto inverso al del resto del sitio, y es lo que hace legal
// tener un directorio de personas con nombre y teléfono permanentes.
//
// Nada de /servicios se despliega hasta que exista el contrato de encargo
// firmado y el registro en el RNBD a nombre de la fundación (PLAN-V3 §7).
export const RESPONSABLE_SERVICIOS = 'Fundación Nodo Social'
// TODO PLAN-V3 §7: pedir el NIT del certificado del RUES y el correo de
// habeas data que la fundación vaya a atender. Hasta entonces el aviso de
// privacidad de Servicios está incompleto y no se puede publicar.
export const NIT_RESPONSABLE_SERVICIOS = '[PENDIENTE]'
export const CORREO_HABEAS_DATA_SERVICIOS = '[PENDIENTE]'

// Lo que firma un proveedor al publicar su ficha, y lo que declara haber
// obtenido de la persona que da como referencia. Se guardan en
// `proveedores.autorizacion_version` y `referencias.consentimiento_version`,
// así que son la prueba de QUÉ texto aceptó cada quien. Se mueven solo
// cuando el texto de `docs/legal/PLANTILLAS.md` cambia, y no antes.
export const AUTORIZACION_PROVEEDOR_VERSION = 'servicios-proveedor-2026-08-19'
export const CONSENTIMIENTO_REFERENCIA_VERSION = 'servicios-referencia-2026-08-19'

export const ENTIDADES_MATRICULA = [
  { valor: 'COPNIA', etiqueta: 'COPNIA — Ingeniería' },
  { valor: 'CPNAA', etiqueta: 'CPNAA — Arquitectura' },
  { valor: 'COLPSIC', etiqueta: 'COLPSIC — Psicología' },
  { valor: 'ReTHUS', etiqueta: 'ReTHUS — Profesiones de la salud' },
  { valor: 'SIRNA', etiqueta: 'SIRNA — Derecho' },
  { valor: 'OTRA', etiqueta: 'Otra entidad' },
] as const
