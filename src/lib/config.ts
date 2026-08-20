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
export const FECHA_LEGALES = '20 de agosto de 2026'

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

/**
 * El buscador de cada registro, para verificar una matrícula.
 *
 * Verificar es ir a mirar si ese número aparece en el registro de la
 * entidad, y hasta ahora eso había que buscarlo a mano cada vez.
 *
 * ⚠ Son enlaces profundos, comprobados uno por uno contra la fuente
 * oficial el 20 de agosto de 2026. Un enlace profundo a un trámite de una
 * entidad pública se muere solo, así que si alguno deja de abrir, el
 * arreglo es volver a buscarlo desde la raíz del dominio y cambiarlo aquí
 * — nunca dejar el enlace roto, que hace pensar que el registro no existe.
 *
 * Dos de los cinco no llevan al formulario sino a la página que lo
 * explica, y es a propósito:
 *
 *   · CPNAA — el buscador vive en su oficina virtual detrás de un inicio
 *     de sesión, así que mandar ahí sería mandar a una pantalla de
 *     contraseña. Esta página dice con qué se puede consultar —cédula,
 *     pasaporte o número de matrícula— y lleva al sitio correcto.
 *   · SIRNA — la Rama Judicial no publica una URL directa al formulario;
 *     esta es la que ella misma enlaza desde el Registro Nacional de
 *     Abogados.
 *
 * COLPSIC va sin `www`: el subdominio con `www` responde con un
 * certificado que no corresponde a ese nombre y el navegador lo bloquea.
 *
 * OTRA no está aquí porque no tiene registro consultable, y esa ausencia
 * es la que decide la cola: sin registro no se puede verificar.
 */
export const REGISTROS_MATRICULA: Record<string, string> = {
  COPNIA:
    'https://www.copnia.gov.co/atencion-al-ciudadano/consultas-en-linea/verifique-el-numero-de-matricula-profesional',
  CPNAA:
    'https://www.cpnaa.gov.co/consulta-del-registro-de-arquitectos-y-profesionales-auxiliares-de-la-arquitectura/',
  COLPSIC: 'https://sara.colpsic.org.co/publico/verificacion-tarjetas',
  ReTHUS:
    'https://web.sispro.gov.co/THS/Cliente/ConsultasPublicas/ConsultaPublicaDeTHxIdentificacion.aspx',
  SIRNA: 'https://sirna.ramajudicial.gov.co/Paginas/Inicio.aspx',
}
