// Los avisos de honestidad sobre el Flujo 1.
//
// AquíVe no verifica a nadie, y eso hay que decirlo donde la gente lo lea,
// no enterrado en los términos. Esto es copy, no código, y es lo que
// sostiene la posición del proyecto si algo sale mal entre dos personas
// que se conocieron aquí.
//
// Viven en un solo archivo porque aparecen en cuatro sitios —la tarjeta
// del tablero, la confirmación de publicación, el momento de abrir el
// contacto, y los términos— y la única forma de que digan lo mismo es que
// salgan de aquí. `docs/legal/PLANTILLAS.md` §4 los espeja: si cambia uno,
// cambia el otro.
//
// ⚠ Lo que estos textos NO pueden hacer, nunca: sugerir que la plataforma
// respalda, avala o recomienda a alguien. Ni sellos de "confiable", ni
// estrellas, ni reputación. Un sistema de reputación sin verificación de
// identidad es una invitación al fraude por acumulación, y además
// arrastraría responsabilidad hacia el responsable del proyecto.

/** Una línea. Para la tarjeta del tablero, donde hay poco espacio. */
export const AVISO_CORTO = 'AquíVe no verifica a quien publica ni a quien responde.'

/** El aviso completo, para la confirmación de publicación. */
export const AVISO_PUBLICAR =
  'Cuando alguien responda vas a ver su nombre y su forma de contacto. ' +
  'AquíVe no verifica quién publica ni quién responde: confirma lo que ' +
  'puedas antes de acordar una entrega, y prefiere lugares públicos.'

/** Justo antes de abrir WhatsApp, que es donde de verdad se decide. */
export const AVISO_CONTACTO =
  'AquíVe no verificó la identidad de esta persona. Prefiere un lugar ' +
  'público y de día, y no pagues nada por adelantado.'

/**
 * La misma idea para un profesional con matrícula verificada. Decir "no
 * verificamos a nadie" ahí sería falso y contradiría el sello; decir que
 * está verificado a secas sería peor, porque el sello solo dice que ese
 * número aparece en el registro de la entidad.
 */
export const AVISO_CONTACTO_VERIFICADO =
  'Verificamos que su matrícula aparece en el registro, no su identidad ' +
  'ni sus intenciones. Prefiere un lugar público y de día.'

/** Consejos de la página /seguridad. Sin dramatismo, en orden de utilidad. */
export const CONSEJOS: { titulo: string; texto: string }[] = [
  {
    titulo: 'Encuéntrate en un lugar público y de día',
    texto:
      'Un parque, una tienda, la entrada del albergue. Si puedes, que no sea en tu casa ni en la de la otra persona.',
  },
  {
    titulo: 'No des tu dirección exacta hasta estar de acuerdo',
    texto:
      'El barrio basta para coordinar. La dirección se da al final, y solo si de verdad hace falta.',
  },
  {
    titulo: 'No pagues nada por adelantado',
    texto:
      'Aquí nadie debería pedirte dinero, ni por la ayuda ni por el transporte ni por un trámite. Si te lo piden, repórtalo y no sigas.',
  },
  {
    titulo: 'Cuéntale a alguien a dónde vas',
    texto:
      'Un familiar, un vecino, quien coordina el albergue. Dile con quién te vas a ver y a qué hora.',
  },
  {
    titulo: 'Si algo no se siente bien, no sigas',
    texto:
      'No tienes que dar explicaciones ni responder. Puedes borrar tu solicitud cuando quieras y volver a publicarla después.',
  },
]
