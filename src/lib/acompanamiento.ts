// El Flujo 2 en una línea: una organización aliada coordina la entrega, y
// para eso quien pide ayuda entrega nombre, documento y un teléfono.
//
// Lo que sale de `aliados_del_municipio`.
//
// Antes traía solo `{id, nombre}`, con el argumento de que un desplegable
// de fundaciones convertía una oferta en una decisión de compras. El
// argumento no sobrevivió al uso: sin saber dónde queda cada acopio no se
// puede escoger la que quede más fácil, y esa es la decisión que importa
// cuando hay que ir a pie.
export interface AliadoDelMunicipio {
  id: string
  nombre: string
  direccion_acopio: string | null
  horario_acopio: string | null
}

// Regla R: elegir el Flujo 2 nunca puede ser el camino de menor
// resistencia. Estos textos se ofrecen, se explican y se aceptan — no
// preseleccionan nada, no aparecen dos veces y no pintan de rojo la opción
// anónima. Si alguna vez hay que reescribirlos, esa es la vara.
export const AVISO_ALIADO_MUNICIPIO =
  'Pueden coordinar la entrega, para que no tengas que encontrarte con nadie que no conozcas. Al final te preguntamos si quieres, y ahí decides: tu solicitud se publica igual si prefieres que no.'

export const AVISO_ACOMPANAMIENTO_DATOS =
  'Para acompañarte, la fundación necesita tu nombre, tu documento y un teléfono. Los ve solo ella: no salen en la página pública, no se los damos a quien responde, y se borran cuando se borre tu solicitud.'

export const AVISO_ACOMPANAMIENTO_SIN_VUELTA =
  'Esto no se puede deshacer desde aquí. Si te arrepientes, borra la solicitud y publica otra: es tu derecho y el botón está más abajo.'
