import {
  RESPONSABLE,
  RAZON_SOCIAL_RESPONSABLE,
  CORREO_CONTACTO,
  FECHA_LEGALES,
  RESPONSABLE_SERVICIOS,
  NIT_RESPONSABLE_SERVICIOS,
} from '@/lib/config'

// ⚠ Aquí había DOS regímenes de datos y el aviso los describía por
// separado: la ayuda de emergencia, que prometía no guardar nada de quien
// pedía, y el directorio de servicios, que guarda personas de forma
// permanente. El módulo de emergencia se retiró entero (ADR 0014), y con
// él su mitad de este documento.
//
// Retirarlo es CUMPLIR lo que este mismo aviso ya prometía —«dejará de
// operar cuando deje de ser útil… eliminaremos sus bases de datos»—, no
// cambiar la promesa. Lo que queda es un solo régimen y un solo
// responsable, que es más fácil de sostener y más fácil de leer.
export default function PrivacidadPage() {
  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      {/* La etiqueta de arriba dice qué documento es esto; el `h1` dice qué
          promete. Sin ella, «Cómo tratamos la información» podía ser una
          página de ayuda cualquiera y no el aviso que tiene efecto legal. */}
      <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
        Aviso de privacidad
      </p>
      <h1 className="font-heading mt-2 text-3xl">Cómo tratamos la información en AquíVe</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Última actualización: {FECHA_LEGALES}
      </p>

      <div className="shadow-canto mt-6 rounded-2xl bg-card p-4">
        <p className="text-base">
          De quien <strong>busca o pide</strong> no publicamos nada: su cuenta lleva un nombre y un
          municipio, y no salen en ninguna lista. De quien <strong>ofrece</strong> sí hay un
          directorio público, con su nombre y su teléfono, y permanece hasta que lo borre. Abajo
          está cada caso por separado.
        </p>
      </div>

      <h2 className="font-heading mt-8 text-2xl">Quién es responsable</h2>
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
        Hay además centros de acopio que trabajan <strong>con</strong> la plataforma —aparecen por
        su nombre, con su dirección y su horario— pero ninguno la opera.
      </p>

      <h2 className="font-heading mt-10 border-t border-border pt-6 text-3xl">Tu cuenta</h2>
      <p className="mt-3 text-base">
        Al entrar te pedimos dos cosas: cómo quieres que te llamemos y en qué municipio estás. Nada
        de eso se publica. El nombre lo ve quien reciba un mensaje tuyo; el municipio solo sirve
        para enseñarte lo que hay cerca. No te pedimos teléfono, y no firmas ninguna autorización:
        no hay nada que publicar todavía.
      </p>
      <p className="mt-3 text-base">
        Publicar es siempre un paso aparte, con su propia casilla y su propia fecha: armar tu ficha
        del directorio, declarar una matrícula profesional o publicar en el muro. Hasta que lo
        hagas, tu cuenta no aparece en ninguna lista.
      </p>

      <h2 className="font-heading mt-8 text-2xl">Si declaras una matrícula profesional: eso sí es público.</h2>
      <p className="mt-3 text-base">
        Guardamos tu nombre visible, tus municipios, tu forma de contacto, tu descripción, tu
        profesión y tu número de matrícula. Estos datos se muestran públicamente, porque esa es la
        finalidad: que alguien que necesita ese servicio pueda contactarte.
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

      {/* ⚠ Aquí iba «Si pides que una fundación te acompañe: ahí sí
          guardamos datos tuyos, cifrados» — nombre, teléfono, la bitácora de
          quién los consultaba y el reparto responsable/encargado con la
          fundación.

          El ADR 0007 retiró el flujo acompañado entero y borró `identidades`
          y `accesos_identidad`. Desde entonces esta sección describía algo
          que no ocurre: no se guarda ningún dato de quien pide más allá de su
          cuenta, y no hay ninguna fundación consultándolos.

          Lo que sí sobrevive y sí se cifra son las REFERENCIAS de un
          prestador —el contacto de un cliente anterior, que es un tercero que
          no está en la plataforma—, y eso se explica en su propia sección.
          Ver `docs/PENDIENTES-LEGALES.md`. */}


      <h2 className="font-heading mt-10 border-t border-border pt-6 text-3xl">Servicios</h2>
      <p className="mt-3 text-base">
        Esta parte de AquíVe existe para que quien vive de su trabajo pueda ser encontrado después
        del sismo. Funciona distinto a todo lo anterior y por eso está separada: aquí los datos
        permanecen y la responsable es {RESPONSABLE_SERVICIOS}.
      </p>

      <h2 className="font-heading mt-8 text-2xl">Si necesitas un servicio: seguimos sin guardar datos tuyos.</h2>
      <p className="mt-3 text-base">
        Buscar en el directorio no exige cuenta ni deja rastro tuyo. Publicar lo que necesitas sí
        pide una cuenta —para que puedas volver a lo tuyo, renovarlo y borrarlo—, pero de la
        solicitud guardamos únicamente el oficio, el municipio, la zona, qué tan urgente es, si
        puedes pagar y una nota opcional de 140 caracteres. Nada de nombre, teléfono, dirección
        exacta ni quiénes viven contigo. Si no tienes cuenta de Google, la fundación te crea una.
      </p>
      <p className="mt-3 text-base">
        Esa solicitud se borra a los 15 días. Puedes renovarla, cerrarla o borrarla antes desde tu
        perfil. Al borrarla queda un registro anónimo
        —municipio, oficio y si alguien respondió— que no permite identificar a nadie.
      </p>
      <p className="mt-3 text-base">
        Cuando alguien te responda vas a ver su nombre y su teléfono, y eres tú quien decide a quién
        escribir. La conversación ocurre por fuera de esta plataforma y nosotros no vemos nada de
        ella.
      </p>

      <h2 className="font-heading mt-8 text-2xl">Qué comprobamos antes de publicar una ficha</h2>
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

      <h2 className="font-heading mt-8 text-2xl">Si ofreces un servicio: tu ficha es pública y permanece.</h2>
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
        dinero, no cobramos comisión y no hay pasarela de pago en ninguna parte de este sitio. Sí alojamos el chat
        de la plataforma, que es donde se acuerda un servicio o una entrega sin tener que dar el
        teléfono: ese chat se borra con lo que lo abrió y no se archiva. Si en cambio decides
        escribir por WhatsApp o llamar, eso ocurre por fuera y nosotros no vemos nada.
      </p>

      <h2 className="font-heading mt-8 text-2xl">Tus derechos</h2>
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

      <h2 className="font-heading mt-8 text-2xl">Cómo borrar lo que guardamos de ti</h2>
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
        Si nada de esto te sirve, escríbenos a {CORREO_CONTACTO} o pon una PQR en /pqr, que no
        necesita cuenta.
      </p>
      <p className="mt-3 text-base">
        Lo único que no se borra es el registro de <em>quién miró</em> tus datos: quién fue, cuándo y con qué
        motivo. Nunca qué vio. Sobrevive a propósito, porque es tu prueba de que alguien los consultó.
      </p>

      <h2 className="font-heading mt-8 text-2xl">La ayuda de emergencia ya no opera.</h2>
      <p className="mt-3 text-base">
        Fue creada para el sismo del 10 de agosto de 2026 y se retiró en agosto de ese mismo año,
        como este aviso decía que ocurriría. Con ella se eliminaron sus bases de datos: las
        solicitudes, las respuestas, los inventarios declarados y sus registros anónimos. No queda
        nada de esa parte.
      </p>
    </main>
  )
}
