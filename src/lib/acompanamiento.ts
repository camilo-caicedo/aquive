// El Flujo 2 en una línea: una organización aliada coordina la entrega, y
// para eso quien pide ayuda entrega nombre, documento y un teléfono.
//
// Lo que sale de `aliado_en_municipio`. Es TODO lo que se puede saber de
// una organización sin haber elegido nada: su nombre, para poder decirlo
// en la tarjeta, y su identificador, para poder mandarlo de vuelta.
export interface AliadoDelMunicipio {
  id: string
  nombre: string
}

// Regla R: elegir el Flujo 2 nunca puede ser el camino de menor
// resistencia. Estos textos se ofrecen, se explican y se aceptan — no
// preseleccionan nada, no aparecen dos veces y no pintan de rojo la opción
// anónima. Si alguna vez hay que reescribirlos, esa es la vara.
export const AVISO_ALIADO_MUNICIPIO =
  'Puede coordinar la entrega, para que no tengas que encontrarte con nadie que no conozcas. Si te interesa, publica primero: en la pantalla de tu solicitud te preguntamos, y ahí decides.'

export const AVISO_ACOMPANAMIENTO_DATOS =
  'Para acompañarte, la fundación necesita tu nombre, tu documento y un teléfono. Los ve solo ella: no salen en la página pública, no se los damos a quien responde, y se borran cuando se borre tu solicitud.'

export const AVISO_ACOMPANAMIENTO_SIN_VUELTA =
  'Esto no se puede deshacer desde aquí. Si te arrepientes, borra la solicitud y publica otra: es tu derecho y el botón está más abajo.'
