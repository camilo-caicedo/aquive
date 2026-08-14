import { RESPONSABLE, CORREO_CONTACTO, FECHA_LEGALES } from '@/lib/config'

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading text-3xl">Cómo tratamos la información en AquíVe</h1>
      <p className="mt-3 text-base">Última actualización: {FECHA_LEGALES}</p>

      <h2 className="font-heading mt-6 text-2xl">Quién es responsable</h2>
      <p className="mt-3 text-base">
        {RESPONSABLE}, persona natural, Cali, Colombia.
      </p>
      <p className="mt-3 text-base">
        Correo de contacto: {CORREO_CONTACTO}.
      </p>
      <p className="mt-3 text-base">
        Este es un proyecto personal y sin ánimo de lucro, hecho por una sola persona para apoyar
        a los afectados por el sismo del 10 de agosto de 2026. No hay ninguna empresa, fundación
        ni entidad detrás.
      </p>

      <h2 className="font-heading mt-6 text-2xl">Si publicas una solicitud de ayuda: no guardamos ningún dato tuyo.</h2>
      <p className="mt-3 text-base">
        No pedimos ni almacenamos tu nombre, cédula, teléfono, correo, dirección exacta, edad ni la de tu
        familia. Una solicitud contiene únicamente el municipio, el barrio, los artículos que necesitas y una
        nota opcional.
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

      <h2 className="font-heading mt-6 text-2xl">Si ofreces ayuda o servicios: sí guardamos algunos datos, y son públicos.</h2>
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
        Si la aceptas, guardamos tu nombre, tu tipo y número de documento y, si nos lo das, un teléfono. Van
        cifrados, en una tabla aparte, y no aparecen en ninguna página pública ni se le entregan a quien ofrece
        ayuda. La finalidad es una sola: que la fundación pueda verificar la entrega en su punto de acopio.
      </p>
      <p className="mt-3 text-base">
        No recibimos documentos de menores de edad. Solo cédula de ciudadanía, cédula de extranjería, PEP o PPT.
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

      <h2 className="font-heading mt-6 text-2xl">Lo que nunca hacemos</h2>
      <p className="mt-3 text-base">
        No vendemos ni compartimos información con terceros. No hacemos publicidad. No procesamos dinero. En el
        flujo directo no alojamos las conversaciones entre las personas: cuando contactas a alguien, lo haces por
        fuera de esta plataforma y nosotros no vemos nada de eso.
      </p>

      <h2 className="font-heading mt-6 text-2xl">Tus derechos</h2>
      <p className="mt-3 text-base">
        Conforme a la Ley 1581 de 2012 puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar la
        autorización. Escríbenos a {CORREO_CONTACTO}: una consulta la respondemos en 10 días hábiles y un reclamo
        en 15, que son los plazos de los artículos 14 y 15.
      </p>
      <p className="mt-3 text-base">
        Si tu solicitud tiene acompañamiento, no hace falta que escribas: desde el enlace de tu solicitud puedes
        ver todo lo que guardamos, quién lo ha consultado y borrarlo ahí mismo, sin pedirle permiso a nadie.
      </p>

      <h2 className="font-heading mt-6 text-2xl">Esta plataforma es temporal.</h2>
      <p className="mt-3 text-base">
        Fue creada para la emergencia del sismo del 10 de agosto de 2026 y dejará de operar cuando deje de ser
        útil. Cuando eso ocurra, eliminaremos todas las bases de datos.
      </p>
    </main>
  )
}
