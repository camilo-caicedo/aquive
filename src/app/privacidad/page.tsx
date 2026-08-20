import {
  RESPONSABLE,
  RAZON_SOCIAL_RESPONSABLE,
  CORREO_CONTACTO,
  FECHA_LEGALES,
  RESPONSABLE_SERVICIOS,
  NIT_RESPONSABLE_SERVICIOS,
} from '@/lib/config'

// Dos regímenes de datos, y hay que verlos como dos desde la primera
// pantalla. El de emergencia promete que no se guarda nada y se borra
// solo; el de servicios guarda un directorio de personas de forma
// permanente y tiene otro responsable. Mezclarlos en un texto corrido
// produciría un aviso que no se puede cumplir.
//
// La promesa del módulo de emergencia NO se diluye aquí. Sigue diciéndose
// con las mismas palabras y con el mismo tamaño: si se suaviza para que
// «encaje» con el directorio, se rompe lo único que sostiene jurídicamente
// al flujo directo (sin titular identificable no hay titular).
export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading text-3xl">Cómo tratamos la información en AquíVe</h1>
      <p className="mt-3 text-base">Última actualización: {FECHA_LEGALES}</p>

      <div className="border-border mt-6 rounded-2xl border p-4">
        <p className="text-base">
          AquíVe tiene dos partes y funcionan al revés la una de la otra. En <strong>ayuda de
          emergencia</strong> no guardamos datos de quien pide y todo se borra solo. En{' '}
          <strong>servicios</strong> hay un directorio de personas que trabajan, con su nombre y su
          teléfono, y ese directorio permanece. Abajo está cada una por separado.
        </p>
      </div>

      <h2 className="font-heading mt-6 text-2xl">Quién es responsable</h2>
      {/* ⚠ Un solo responsable. Hasta el 20/08/2026 aquí había dos bloques
          —la persona natural para la emergencia, la fundación para el
          directorio— y con ellos el nombre completo de una persona en una
          página pública. La línea del NIT no se dibuja si no hay número:
          mejor no decirlo que imprimir «[PENDIENTE]» en un aviso de
          privacidad. */}
      <p className="mt-3 text-base">
        {/* Una sola interpolación: partirla en dos deja un espacio de JSX
            antes de la coma —«Fundación Nodo Social , entidad»—. */}
        {`${RAZON_SOCIAL_RESPONSABLE || RESPONSABLE}${
          NIT_RESPONSABLE_SERVICIOS ? `, NIT ${NIT_RESPONSABLE_SERVICIOS}` : ''
        }, entidad sin ánimo de lucro, Cali, Colombia.`}{' '}
        Correo de contacto: {CORREO_CONTACTO}.
      </p>
      <p className="mt-3 text-base">
        Es un proyecto sin ánimo de lucro: primero para apoyar a los afectados por el sismo del 10
        de agosto de 2026, y después para que quien vive de un oficio pueda darse a conocer. La
        plataforma no cobra nada a nadie ni recibe dinero de nadie.
      </p>
      <p className="mt-3 text-base">
        Hay además fundaciones que trabajan <strong>con</strong> la plataforma en la ayuda de
        emergencia —aparecen por su nombre y solo si tú las escoges— pero ninguna la opera. Ver «Si
        pides que una fundación te acompañe», más abajo.
      </p>

      <h2 className="font-heading mt-8 text-2xl">Ayuda de emergencia</h2>

      <h2 className="font-heading mt-6 text-2xl">Si publicas una solicitud de ayuda: no guardamos ningún dato tuyo, salvo que tú decidas dejarlo.</h2>
      <p className="mt-3 text-base">
        No pedimos ni almacenamos tu cédula, dirección exacta, edad ni la de tu familia. Una solicitud contiene
        únicamente el municipio, el barrio, los artículos que necesitas y una nota opcional.
      </p>
      <p className="mt-3 text-base">
        Al publicar puedes dejar, si quieres, un nombre, un teléfono o un correo — los tres son opcionales, y
        puedes dejar solo uno o ninguno. Si dejas alguno, te pedimos que lo confirmes explícitamente antes de
        publicar. Ese contacto queda aparte de tu solicitud, en una tabla separada, y solo lo ven dos personas:
        quien responda esa solicitud puntual y el administrador de AquíVe. No aparece en el tablero público, ni
        en ninguna otra pantalla, ni se lo damos a nadie más. Se borra con tu solicitud, a las 72 horas, como
        todo lo demás.
      </p>
      <p className="mt-3 text-base">
        Al publicar recibes un enlace secreto. Es la única forma de volver a tu solicitud. No podemos
        recuperarlo porque no guardamos a quién pertenece.
      </p>
      <p className="mt-3 text-base">
        Si activas las notificaciones, tu navegador nos entrega una dirección técnica anónima para avisarte.
        No es tu número ni tu correo, no sirve para identificarte y la puedes desactivar cuando quieras.
      </p>
      <p className="mt-3 text-base">
        Tu solicitud se borra sola. A las 72 horas se elimina de forma definitiva de nuestra base de datos,
        junto con las respuestas y la notificación. Puedes renovarla o borrarla antes en cualquier momento.
      </p>
      <p className="mt-3 text-base">
        Al borrarla conservamos un registro anónimo —municipio, categoría, si se resolvió y cuánto tardó— que
        no permite identificar a nadie y sirve para entender qué se necesitó y dónde.
      </p>

      <h2 className="font-heading mt-6 text-2xl">Si ofreces ayuda o servicios profesionales: sí guardamos algunos datos, y son públicos.</h2>
      <p className="mt-3 text-base">
        Guardamos tu nombre visible, municipios donde puedes ayudar, tu forma de contacto, tu descripción y, si
        eres profesional, tu profesión y número de matrícula. Estos datos se muestran públicamente, porque esa es
        la finalidad: que alguien que necesita ayuda pueda contactarte.
      </p>
      <p className="mt-3 text-base">
        No guardamos tu correo electrónico. Al entrar con Google recibimos un identificador interno y descartamos
        el correo.
      </p>
      <p className="mt-3 text-base">
        Finalidad: permitir que personas afectadas te contacten y verificar tu matrícula profesional.
      </p>
      <p className="mt-3 text-base">
        Puedes borrar tu perfil completo desde tu cuenta, en cualquier momento.
      </p>

      <h2 className="font-heading mt-6 text-2xl">
        Si pides que una fundación te acompañe: ahí sí guardamos datos tuyos, cifrados.
      </h2>
      <p className="mt-3 text-base">
        Publicar una solicitud no exige esto y nunca lo va a exigir. Es una opción aparte, que se ofrece solo si
        hay una organización aliada trabajando en tu municipio, y que solo existe si tú la aceptas.
      </p>
      <p className="mt-3 text-base">
        Si la aceptas, guardamos <strong>tu nombre y, si nos lo das, un teléfono. Nada más.</strong> Van
        cifrados, en una tabla aparte, y no aparecen en ninguna página pública ni se le entregan a quien ofrece
        ayuda. La finalidad es una sola: que la fundación sepa a quién le está entregando.
      </p>
      <p className="mt-3 text-base">
        <strong>No pedimos ni guardamos números de documento.</strong> Si la fundación necesita comprobar tu
        identidad para entregarte algo, lo hace mirando tu cédula en persona, en su punto: no la teclea aquí y
        no queda ninguna copia en la plataforma.
      </p>
      <p className="mt-3 text-base">
        Cada vez que alguien de la fundación consulta esos datos queda registrado quién fue, cuándo y con qué
        motivo. Puedes ver ese registro completo desde el enlace de tu solicitud, en «ver qué datos tuyos
        guardamos», y desde ahí pedir que los borremos.
      </p>
      <p className="mt-3 text-base">
        En este caso la fundación es responsable del tratamiento y nosotros actuamos como encargados: ellos
        deciden para qué usan esos datos y los custodian en sus propios sistemas; nosotros solo los guardamos
        mientras dure la coordinación. Se borran con tu solicitud, y la solicitud se borra sola.
      </p>
      <p className="mt-3 text-base">
        La conversación con la fundación y con quien ofrece ocurre dentro de la plataforma, y también se borra
        con la solicitud. No es un archivo: no la uses para guardar nada que necesites después.
      </p>

      <h2 className="font-heading mt-8 text-2xl">Servicios</h2>
      <p className="mt-3 text-base">
        Esta parte de AquíVe existe para que quien vive de su trabajo pueda ser encontrado después
        del sismo. Funciona distinto a todo lo anterior y por eso está separada: aquí los datos
        permanecen y la responsable es {RESPONSABLE_SERVICIOS}.
      </p>

      <h2 className="font-heading mt-6 text-2xl">Si necesitas un servicio: seguimos sin guardar datos tuyos.</h2>
      <p className="mt-3 text-base">
        Buscar en el directorio no exige cuenta ni deja rastro tuyo. Si publicas lo que necesitas,
        guardamos únicamente el oficio, el municipio, la zona, qué tan urgente es, si puedes pagar y
        una nota opcional de 140 caracteres. Nada de nombre, teléfono, dirección exacta ni quiénes
        viven contigo.
      </p>
      <p className="mt-3 text-base">
        Esa solicitud se borra a los 15 días. Puedes renovarla, cerrarla o borrarla antes desde tu
        enlace secreto, igual que en la ayuda de emergencia. Al borrarla queda un registro anónimo
        —municipio, oficio y si alguien respondió— que no permite identificar a nadie.
      </p>
      <p className="mt-3 text-base">
        Cuando alguien te responda vas a ver su nombre y su teléfono, y eres tú quien decide a quién
        escribir. La conversación ocurre por fuera de esta plataforma y nosotros no vemos nada de
        ella.
      </p>

      <h2 className="font-heading mt-6 text-2xl">Qué comprobamos antes de publicar una ficha</h2>
      <p className="mt-3 text-base">
        Una sola cosa: que el teléfono contesta. Alguien de {RESPONSABLE} marca el número que diste y confirma
        que contestas tú. Hasta que eso pase, tu ficha no se ve en el directorio, aunque esté completa.
      </p>
      <p className="mt-3 text-base">
        <strong>Eso no es una verificación de identidad</strong> y no debe leerse como una recomendación. No
        comprobamos tu cédula, ni tu experiencia, ni tus antecedentes, ni la calidad de tu trabajo. Para algunos
        oficios —cuidado de niños, cuidado de personas dependientes, transporte de pasajeros— pedimos además una
        referencia de un cliente anterior, y tampoco eso es una verificación de identidad: una referencia la
        puede dar un conocido.
      </p>

      <h2 className="font-heading mt-6 text-2xl">Si ofreces un servicio: tu ficha es pública y permanece.</h2>
      <p className="mt-3 text-base">
        Guardamos tu nombre visible, tu teléfono, si eres persona o microempresa, tus oficios con su
        precio, tu municipio y zona, tus horarios, tus medios de pago y tu descripción. Todo eso{' '}
        <strong>se muestra públicamente en internet</strong>, porque esa es la finalidad: que alguien
        que necesita tu trabajo pueda encontrarte y llamarte. Es un directorio abierto, no una lista
        privada.
      </p>
      <p className="mt-3 text-base">
        Tu ficha no caduca sola: se queda hasta que tú la borres. Puedes hacerlo cuando quieras, y el
        borrado es definitivo — no la guardamos en ninguna copia. Si te dio de alta la fundación
        porque no tienes cuenta de Google, recibiste un enlace secreto que hace exactamente lo mismo:
        con él ves lo que guardamos, lo corriges y lo borras sin pedirle permiso a nadie.
      </p>
      <p className="mt-3 text-base">
        Si das el contacto de un cliente anterior como referencia, esa persona es un tercero: su
        nombre y su teléfono se guardan <strong>cifrados</strong>, nunca aparecen en ninguna página
        pública y solo los puede consultar la fundación para llamarla y confirmar. Cada consulta deja
        registrado quién la hizo, cuándo y con qué motivo. Necesitas su autorización antes de darla,
        y al darla nos declaras que la tienes.
      </p>
      <p className="mt-3 text-base">
        Las calificaciones que recibes quedan asociadas a tu ficha y se van con ella cuando la
        borras. Puedes responder públicamente a cualquiera de ellas.
      </p>

      <h2 className="font-heading mt-8 text-2xl">Lo que nunca hacemos, en las dos partes</h2>
      <p className="mt-3 text-base">
        No vendemos ni compartimos información con terceros. No hacemos publicidad. No procesamos
        dinero, no cobramos comisión y no hay pasarela de pago en ninguna parte de este sitio. Salvo
        el chat del acompañamiento, no alojamos conversaciones entre personas: cuando contactas a
        alguien, lo haces por fuera de esta plataforma y nosotros no vemos nada de eso.
      </p>

      <h2 className="font-heading mt-6 text-2xl">Tus derechos</h2>
      <p className="mt-3 text-base">
        Conforme a la Ley 1581 de 2012 puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar la
        autorización. Escríbenos a {CORREO_CONTACTO}, sea cual sea la parte del sitio. Una consulta
        se responde en 10 días hábiles y un reclamo en 15, que son los plazos de los artículos 14 y 15.
      </p>
      <p className="mt-3 text-base">
        En la mayoría de los casos no hace falta que escribas: desde el enlace de tu solicitud, desde
        tu cuenta o desde el enlace de tu ficha de proveedor puedes ver todo lo que guardamos y
        borrarlo ahí mismo, sin pedirle permiso a nadie.
      </p>

      <h2 className="font-heading mt-6 text-2xl">Cómo borrar lo que guardamos de ti</h2>
      <p className="mt-3 text-base">
        Depende de qué sea, y en los tres casos lo puedes hacer tú sin pedirle permiso a nadie:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-base">
        <li>
          <strong>Tu solicitud de ayuda</strong> se borra sola a las 72 horas, con todo lo que lleva dentro. Si
          quieres antes, entra con tu enlace y bórrala: desaparece en el momento.
        </li>
        <li>
          <strong>Tu perfil de quien ofrece</strong> se borra desde «Lo mío», en los ajustes de tu cuenta.
        </li>
        <li>
          <strong>Tu ficha del directorio de servicios</strong> se borra desde tu propia ficha, con el enlace
          que te dimos al publicarla, y se va con las calificaciones que hayas recibido.
        </li>
      </ul>
      <p className="mt-3 text-base">
        Si diste tu nombre para que una fundación acompañe una entrega, puedes pedir que lo borren desde el
        enlace de tu solicitud, en «ver qué datos tuyos guardamos», sin esperar a las 72 horas. Y si nada de
        esto te sirve, escríbenos a {CORREO_CONTACTO}.
      </p>
      <p className="mt-3 text-base">
        Lo único que no se borra es el registro de <em>quién miró</em> tus datos: quién fue, cuándo y con qué
        motivo. Nunca qué vio. Sobrevive a propósito, porque es tu prueba de que alguien los consultó.
      </p>

      <h2 className="font-heading mt-6 text-2xl">La ayuda de emergencia es temporal.</h2>
      <p className="mt-3 text-base">
        Fue creada para la emergencia del sismo del 10 de agosto de 2026 y dejará de operar cuando deje de ser
        útil. El directorio de servicios está pensado para durar más, porque la recuperación económica
        toma más tiempo. Cuando cualquiera de las dos partes deje de operar, eliminaremos sus bases de
        datos.
      </p>
    </main>
  )
}
