import { RESPONSABLE } from '@/lib/config'

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">Cómo tratamos la información en AquíVe</h1>
      <p className="mt-3 text-base">Última actualización: [FECHA]</p>

      <h2 className="mt-6 text-xl font-bold">Quién es responsable</h2>
      <p className="mt-3 text-base">
        {RESPONSABLE}, persona natural, Cali, Colombia.
      </p>
      <p className="mt-3 text-base">
        Correo de contacto: [CORREO DEDICADO AL PROYECTO].
      </p>
      <p className="mt-3 text-base">
        Este es un proyecto personal y sin ánimo de lucro, hecho por una sola persona para apoyar
        a los afectados por el sismo del 10 de agosto de 2026. No hay ninguna empresa, fundación
        ni entidad detrás.
      </p>

      <h2 className="mt-6 text-xl font-bold">Si publicas una solicitud de ayuda: no guardamos ningún dato tuyo.</h2>
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

      <h2 className="mt-6 text-xl font-bold">Si ofreces ayuda o servicios: sí guardamos algunos datos, y son públicos.</h2>
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

      <h2 className="mt-6 text-xl font-bold">Lo que nunca hacemos</h2>
      <p className="mt-3 text-base">
        No vendemos ni compartimos información con terceros. No hacemos publicidad. No procesamos dinero. No
        alojamos las conversaciones entre las personas: cuando contactas a alguien, lo haces por fuera de esta
        plataforma y nosotros no vemos nada de eso.
      </p>

      <h2 className="mt-6 text-xl font-bold">Tus derechos</h2>
      <p className="mt-3 text-base">
        Conforme a la Ley 1581 de 2012 puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar la
        autorización. Escríbenos a [CORREO] y respondemos en los términos de ley.
      </p>

      <h2 className="mt-6 text-xl font-bold">Esta plataforma es temporal.</h2>
      <p className="mt-3 text-base">
        Fue creada para la emergencia del sismo del 10 de agosto de 2026 y dejará de operar cuando deje de ser
        útil. Cuando eso ocurra, eliminaremos todas las bases de datos.
      </p>
    </main>
  )
}
