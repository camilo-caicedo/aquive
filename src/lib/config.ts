// Aparece en el texto de autorización que firma cada ofertador y servidor
// (docs/legal/PLANTILLAS.md sección 3) y en las páginas legales, así que
// tiene efecto legal. Debe coincidir con lo que diga PLANTILLAS.md.
//
// ⚠ 20/08/2026: deja de ser una persona natural. Hasta ahora había DOS
// responsables a la vez —la persona para la ayuda de emergencia y la
// fundación para el directorio de servicios— y ese reparto se colapsa en
// uno solo. Decisión del responsable, tomada sin abogado de por medio: lo
// que había que quitar de la aplicación era el nombre y la cédula de una
// persona natural expuestos en tres pantallas.
//
// Lo que esto NO resuelve, y sigue pendiente en papel: el contrato entre
// las dos partes, la inscripción de las bases en el RNBD a nombre de la
// fundación, y qué pasa con las autorizaciones que se firmaron con el
// nombre anterior. Ver el inventario del traspaso.
export const RESPONSABLE = 'Nodo Social'
// El buzon de la fundacion, que es la responsable. Sustituye a
// soporte@aquive.co, que era el del proyecto cuando lo operaba una
// persona: el articulo 12 de la Ley 1581 pide la direccion del
// RESPONSABLE, y apuntar a otro buzon dejaba el aviso senalando a quien ya
// no responde.
export const CORREO_CONTACTO = 'gerencia@nodosocial.org'
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
export const FECHA_LEGALES = '21 de agosto de 2026'

// El módulo de Servicios tiene OTRO responsable del tratamiento. Aquí la
// fundación decide para qué se usan los datos y AquíVe solo los guarda:
// es el reparto inverso al del resto del sitio, y es lo que hace legal
// tener un directorio de personas con nombre y teléfono permanentes.
//
// Nada de /servicios se despliega hasta que exista el contrato de encargo
// firmado y el registro en el RNBD a nombre de la fundación.
// Ver docs/PENDIENTES-LEGALES.md.
// Mismo responsable que el resto del sitio desde el 20/08/2026. La
// constante sobrevive porque hay pantallas donde nombrar a la organización
// se lee mejor que decir «el responsable» —«pregunta en el punto de Nodo
// Social más cercano»—, no porque quede algún reparto.
export const RESPONSABLE_SERVICIOS = RESPONSABLE
// TODO (ver docs/PENDIENTES-LEGALES.md): pedir el NIT del certificado del RUES y el correo de
// habeas data que la fundación vaya a atender. Hasta entonces el aviso de
// privacidad de Servicios está incompleto y no se puede publicar.
// Los datos con los que el aviso de privacidad identifica al responsable,
// como exige el artículo 12 de la Ley 1581. Llegaron el 21 de agosto de
// 2026.
//
// La razón social se usa en la línea de identificación legal; `RESPONSABLE`
// —el nombre corto— se sigue usando en la prosa, donde «Alguien de
// Fundación Nodo Social marca tu número» se lee peor que «Alguien de Nodo
// Social». Las pantallas que imprimen el NIT siguen sin dibujar la línea si
// algún día se vacía.
export const RAZON_SOCIAL_RESPONSABLE = 'Fundación Nodo Social'
export const NIT_RESPONSABLE_SERVICIOS = '901678605'
// Un solo canal de habeas data para todo el sitio, y es el de la
// fundación: quien ejerce un derecho tiene que llegarle al responsable, no
// a un buzón intermedio. La constante sobrevive porque hay pantallas del
// módulo de servicios que la nombran, no porque queden dos canales.
export const CORREO_HABEAS_DATA_SERVICIOS = CORREO_CONTACTO

// Lo que firma un proveedor al publicar su ficha, y lo que declara haber
// obtenido de la persona que da como referencia. Se guardan en
// `proveedores.autorizacion_version` y `referencias.consentimiento_version`,
// así que son la prueba de QUÉ texto aceptó cada quien. Se mueven solo
// cuando el texto de `docs/legal/PLANTILLAS.md` cambia, y no antes.
export const AUTORIZACION_PROVEEDOR_VERSION = 'servicios-proveedor-2026-08-19'
export const CONSENTIMIENTO_REFERENCIA_VERSION = 'servicios-referencia-2026-08-19'
// La foto lleva la suya, aparte de la de publicar la ficha: publicar la
// cara de alguien es otra finalidad que publicar su teléfono, igual que
// el punto en el mapa (ADR 0004). Quien firmó la de agosto no firmó esta.
export const AUTORIZACION_FOTO_VERSION = 'servicios-foto-2026-08-27'
// La dirección lleva la suya, aparte de la de publicar la ficha y aparte
// de la del mapa: publicar dónde vive o atiende alguien es otra finalidad,
// igual que el punto del ADR 0004 (ADR 0017, artículo 9 de la Ley 1581).
// Quien firmó la ficha o el mapa no firmó esta.
export const AUTORIZACION_DIRECCION_VERSION = 'servicios-direccion-2026-09-03'
// El perfil también publica nombre y teléfono —en /profesionales— y
// también necesita su versión guardada (mínimo legal 2). La
// fecha es la del texto que hoy se lee en el formulario de registro, no la
// de cuando se añadió la columna: decir que alguien aceptó un texto que no
// existía sería peor que no guardar nada.
export const AUTORIZACION_PERFIL_VERSION = 'perfil-2026-08-19'

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
