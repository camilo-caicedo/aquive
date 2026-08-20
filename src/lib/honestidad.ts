// Los avisos de honestidad sobre el Flujo 1.
//
// AquíVe no verifica a nadie, y eso hay que decirlo donde la gente lo lea,
// no enterrado en los términos. Esto es copy, no código, y es lo que
// sostiene la posición del proyecto si algo sale mal entre dos personas
// que se conocieron aquí.
//
// Todo el texto con efecto legal de esta familia vive aquí, incluido el de
// la página /seguridad. `docs/legal/PLANTILLAS.md` lo espeja: si cambia
// uno, cambia el otro, y se mueve `FECHA_LEGALES` en `config.ts`.
//
// ⚠ Lo que estos textos NO pueden hacer, nunca: sugerir que la plataforma
// respalda, avala o recomienda a alguien. Ni sellos de "confiable", ni
// estrellas, ni reputación. Un sistema de reputación sin verificación de
// identidad es una invitación al fraude por acumulación, y además
// arrastraría responsabilidad hacia el responsable del proyecto.
//
// 19/08/2026 — esa última frase dejó de valer para /servicios, y hay que
// decirlo aquí en vez de dejar el comentario contradiciendo al producto.
// El módulo de Servicios SÍ tiene reputación, y la tiene porque no es «sin
// verificación de identidad detrás»: una reseña exige un código que el
// proveedor generó y entregó (regla T), el teléfono lo comprueba una
// persona de la fundación, y una referencia se verifica por muestreo.
//
// Lo que sigue prohibido, ahí también: llamar «confiable» a nadie,
// recomendar a alguien, y presentar cualquiera de esas tres señales como
// garantía. Son señales blandas, y los textos de abajo lo dicen con esas
// palabras. El resto del sitio —tablero, respuestas, entidades— no cambia:
// ahí no hay reputación y no la va a haber.

/** Encabezado de una lista de solicitudes. Se dice una vez, no por tarjeta. */
export const AVISO_TABLERO =
  'AquíVe no verifica a quien publica ni a quien responde. Ninguna de estas solicitudes está comprobada.'

/** El aviso completo, para la confirmación de publicación. */
export const AVISO_PUBLICAR =
  'Cuando alguien responda vas a ver su nombre y su forma de contacto. ' +
  'AquíVe no verifica quién publica ni quién responde: confirma lo que ' +
  'puedas antes de acordar una entrega, y prefiere lugares públicos.'

/**
 * Para quien va a responder una solicitud. Es la otra mitad del recorrido
 * y también es un paso irreversible: entrega su nombre real y su teléfono
 * a alguien anónimo, y después se mueve físicamente a un encuentro.
 *
 * Una solicitud falsa es el fraude obvio de este flujo —publicar "necesito
 * cobijas" para cosechar teléfonos de gente caritativa— y hasta que se
 * escribió esto no había una sola línea que lo dijera.
 */
export const AVISO_RESPONDER =
  'AquíVe no verifica quién publica esta solicitud. Tu nombre y tu forma ' +
  'de contacto quedan visibles para esa persona. Si acuerdan una entrega, ' +
  'prefiere un lugar público y de día.'

/** Justo antes de abrir WhatsApp, que es donde de verdad se decide. */
export const AVISO_CONTACTO =
  'AquíVe no verificó la identidad de esta persona. Prefiere un lugar ' +
  'público y de día, y no pagues nada por adelantado.'

/**
 * La misma idea para un profesional con matrícula verificada. Decir "no
 * verificamos a nadie" ahí sería falso y contradiría el sello que se ve al
 * lado; un aviso que se contradice con lo que está en pantalla enseña a
 * ignorar los avisos.
 *
 * Empieza por lo que el sello NO garantiza y no por "verificamos": quien
 * lee en diagonal se lleva la primera palabra, y "verificamos" es
 * justamente lo contrario de lo que hay que entender.
 */
export const AVISO_CONTACTO_VERIFICADO =
  'El sello solo dice que ese número de matrícula aparece en el registro. ' +
  'No verificamos su identidad, su experiencia ni sus intenciones. ' +
  'Prefiere un lugar público y de día, y no pagues nada por adelantado.'

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
      'Aquí nadie debería pedirte dinero: ni por la ayuda, ni por llevártela, ni por ningún trámite. Si te lo piden, repórtalo y no sigas.',
  },
  {
    titulo: 'Cuéntale a alguien a dónde vas',
    texto:
      'Un familiar, un vecino, quien coordina el albergue. Dile con quién te vas a ver y a qué hora.',
  },
  {
    titulo: 'Si vas a ofrecer ayuda, esto también es para ti',
    texto:
      'Quien publicó la solicitud no está verificado, igual que tú no lo estás para esa persona. Tu nombre y tu teléfono quedan visibles cuando respondes, así que aplica lo mismo: lugar público, de día, y sin pagos de por medio.',
  },
  {
    titulo: 'Si algo no se siente bien, no sigas',
    texto:
      'No tienes que dar explicaciones ni responder. Puedes borrar tu solicitud cuando quieras y volver a publicarla después.',
  },
]

/**
 * Qué significa exactamente el sello de matrícula.
 *
 * En presente universal —"le revisamos"— era una promesa que el producto no
 * puede cumplir: la revisión es manual, discrecional y de una sola persona,
 * y `ENTIDADES_MATRICULA` incluye "OTRA", para la que no hay registro
 * consultable.
 */
export const SOBRE_LOS_PROFESIONALES =
  'Cuando alguien se registra como profesional escribe su entidad y su ' +
  'número de matrícula. Una persona los revisa a mano, uno por uno, y ' +
  'cuando el número aparece en el registro de esa entidad el perfil queda ' +
  'con el sello. Eso es todo lo que dice el sello: que el número existe. ' +
  'No verificamos su identidad, ni su experiencia, ni sus intenciones. Si ' +
  'la entidad no tiene registro consultable, o si nadie ha alcanzado a ' +
  'revisarlo, el perfil se queda sin sello — y sin sello no ha sido ' +
  'revisado en absoluto.'

export const SI_ALGO_SALE_MAL =
  'Las solicitudes, las respuestas, los perfiles y las entidades del ' +
  'directorio tienen un botón para reportar. Lo revisa una persona y puede ' +
  'borrar el contenido, suspender la cuenta o bajar la entidad. Si un ' +
  'enlace deja de llevar a donde decía, eso también se reporta. Si hay ' +
  'riesgo para alguien ahora mismo, eso no es un reporte: es el 123.'

/**
 * ⚠ Este texto decía «ni que entres a ningún otro sitio», y el directorio
 * de entidades lo dejó falso: son botones que sacan de AquíVe a propósito.
 *
 * Una frase antiphishing que la propia aplicación desmiente es peor que no
 * tenerla: enseña a ignorar todos los avisos. Así que dice lo que de verdad
 * distingue un enlace nuestro de uno de un estafador — que nosotros siempre
 * mostramos el dominio antes de que toques.
 */
export const NADIE_TE_PIDE =
  'Nadie de AquíVe te va a pedir dinero ni el enlace de tu solicitud. En ' +
  '"Entidades" hay botones que llevan a sitios de otras organizaciones, y ' +
  'siempre te decimos a qué dirección te llevan antes de que toques: si ' +
  'algo te lleva a otro lado, o te pide pagar, no sigas.'

/** Encabezado de la pestaña de entidades. Se dice una vez, no por ficha. */
export const AVISO_ENTIDADES =
  'AquíVe no verifica a estas organizaciones ni las recomienda: aparecer ' +
  'en esta lista no dice nada sobre ellas.'

/**
 * Pegado a los botones de cada ficha. Va por ficha y no solo arriba porque
 * cada enlace es una decisión distinta — el mismo criterio que ya se tomó
 * dos veces, en el tablero y en la lista de respuestas.
 */
export const AVISO_SALIR_DEL_SITIO =
  'Estos botones te sacan de AquíVe. Mira la dirección antes de tocar, y ' +
  'no pagues nada por adelantado.'

// ─────────────────────────────────────────────────────────────────────
// Módulo de Servicios (PLAN-V3). Otro responsable, otro riesgo, otro copy.
//
// Aquí el encuentro no es una entrega de diez minutos en un parque: es
// alguien entrando a trabajar a una casa, o alguien subiéndose a un carro.
// Los avisos de arriba no alcanzan y no se reusan tal cual.
// ─────────────────────────────────────────────────────────────────────

/** Encabezado del directorio. Se dice una vez, no por tarjeta. */
export const AVISO_SERVICIOS =
  'AquíVe no emplea ni recomienda a estas personas: solo publica lo que ' +
  'ellas dijeron de sí mismas. Acuerda el precio antes de empezar.'

/**
 * Qué sostiene cada insignia, en la ficha. Es lo mismo que
 * SOBRE_LOS_PROFESIONALES hace con la matrícula: explicar el techo del
 * sello en vez de dejar que el usuario le suponga uno.
 */
export const SOBRE_LAS_INSIGNIAS =
  'Teléfono verificado significa que alguien de la fundación llamó a ese ' +
  'número y contestó esta persona. Con referencias significa que dio el ' +
  'contacto de un cliente anterior y que ese cliente confirmó. Servicios ' +
  'confirmados es cuántas veces alguien usó su código después de un ' +
  'trabajo. Ninguna de las tres comprueba su identidad ni su experiencia, ' +
  'y una referencia la puede dar un conocido. Un perfil sin insignias no ' +
  'ha sido revisado en absoluto.'

/**
 * El §7 del documento fuente lo pide neutro, no alarmista: la advertencia
 * tiene que caber en el flujo normal de contratar a alguien, no espantar.
 */
export const NO_PAGUES_POR_ADELANTADO =
  'AquíVe no maneja dinero y no interviene en el pago. Acuerda el precio ' +
  'antes de empezar y paga cuando el trabajo esté hecho: nadie de esta ' +
  'plataforma debería pedirte un adelanto para reservarte el cupo.'

/**
 * Seguridad para un servicio a domicilio. El §7 pide atención diferenciada
 * al riesgo para mujeres, y eso no se resuelve con una frase genérica
 * sobre "tener cuidado": se resuelve diciendo qué hacer.
 */
export const SEGURIDAD_DOMICILIO =
  'Si el servicio es en tu casa o en la de la otra persona, cuéntale a ' +
  'alguien quién viene, a qué hora y cuánto va a durar. Si puedes, que ' +
  'haya alguien más. Puedes pedir que el primer encuentro sea en un lugar ' +
  'público para acordar el trabajo. Si algo no se siente bien, no tienes ' +
  'que dar explicaciones: cancela y repórtalo.'

/** Encabezado de las reseñas de una ficha. */
export const SOBRE_LAS_RESENAS =
  'Solo puede calificar quien recibió el código que esta persona entrega ' +
  'al terminar un trabajo, y cada código sirve una sola vez. Aun así son ' +
  'opiniones, no comprobaciones. Si una reseña te parece injusta o te la ' +
  'usaron como amenaza, repórtala.'

/** El deslinde, para la ficha y para los términos. */
export const DESLINDE_CALIDAD =
  'AquíVe solo pone en contacto. No fija precios, no maneja dinero, no ' +
  'interviene en el acuerdo y no responde por la calidad del servicio, ' +
  'los incumplimientos, las pérdidas ni los daños.'

/**
 * El dominio de una URL, para ponerlo delante de la dirección completa.
 *
 * En 320px una dirección larga empuja el dominio fuera de la vista, y el
 * dominio es lo único que decide a dónde vas. Por eso se muestra aparte y
 * primero, y la dirección completa se envuelve en vez de recortarse:
 * recortar por el medio con puntos suspensivos es exactamente lo que
 * escondería un `…@evil.com`.
 */
export function dominioDe(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
