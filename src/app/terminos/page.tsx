import Link from 'next/link'
import {
  RESPONSABLE,
  CORREO_CONTACTO,
  FECHA_LEGALES,
  RESPONSABLE_SERVICIOS,
} from '@/lib/config'
import {
  DESLINDE_CALIDAD,
  SOBRE_LAS_INSIGNIAS,
  NO_PAGUES_POR_ADELANTADO,
} from '@/lib/honestidad'

export default function TerminosPage() {
  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
        Términos de uso
      </p>
      <h1 className="font-heading mt-2 text-3xl">Términos de uso de AquíVe</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Última actualización: {FECHA_LEGALES}
      </p>

      <h2 className="font-heading mt-8 text-2xl">1. Qué es esto.</h2>
      <p className="mt-3 text-base">
        Un tablón de anuncios gratuito, con dos partes. La ayuda de emergencia permite publicar qué
        artículos se necesitan y a otras personas ofrecerlos; nació para el sismo del 10 de agosto de
        2026 y dejará de operar cuando deje de ser útil. El directorio de servicios permite a quien
        vive de un oficio publicar su ficha, y a quien necesita ese oficio encontrarlo; no tiene fecha
        de cierre. Es un proyecto gratuito y sin ánimo de lucro, operado por {RESPONSABLE}. La
        plataforma no cobra nada a nadie ni recibe dinero de nadie.
      </p>

      <h2 className="font-heading mt-8 text-2xl">2. Qué NO es.</h2>
      <p className="mt-3 text-base">
        No somos una entidad de socorro ni una autoridad. No entregamos ayuda, no transportamos, no
        almacenamos ni distribuimos nada. No reemplazamos a la UNGRD, la Cruz Roja, la Defensa Civil ni a tu
        alcaldía. Para emergencias: 123.
      </p>

      <h2 className="font-heading mt-8 text-2xl">3. No verificamos a las personas.</h2>
      <p className="mt-3 text-base">
        Con excepción de la matrícula profesional de quienes se registran como profesionales, no verificamos la
        identidad, los antecedentes ni las intenciones de nadie. Un sello de matrícula verificada significa
        únicamente que ese número aparece en el registro correspondiente: no dice nada sobre la identidad de
        quien lo usa, su experiencia ni sus intenciones. Un perfil sin ese sello no ha sido revisado en absoluto.
      </p>
      <p className="mt-3 text-base">
        Tampoco recomendamos a nadie, en ninguna parte del sitio. En la ayuda de emergencia no hay
        calificaciones y no las va a haber: sin nada que sostenga la identidad de quien califica, un
        sistema así solo sirve para que quien quiera estafar acumule apariencia de confianza.
      </p>
      <p className="mt-3 text-base">
        En el directorio de servicios <strong>sí hay calificaciones</strong>, y existen porque ahí no
        están sueltas: solo puede calificar quien recibió el código que el proveedor entrega al
        terminar un trabajo, y cada código sirve una sola vez. Que alguien tenga buenas
        calificaciones no es una recomendación nuestra, no comprueba su identidad y no nos hace
        responder por su trabajo. Está explicado en la §12.
      </p>

      <h2 className="font-heading mt-8 text-2xl">3b. El directorio de entidades.</h2>
      <p className="mt-3 text-base">
        En la sección de servicios hay una lista de organizaciones que un administrador dio de alta. Es
        informativa: esas entidades no tienen cuenta aquí, no reciben solicitudes y no coordinan nada por esta
        plataforma. <strong>Aparecer en esa lista no es una recomendación</strong>, ni significa que hayamos
        comprobado quiénes son, qué hacen o cómo lo hacen. Los botones llevan a sitios que no controlamos, y lo
        que ocurra allí —incluido lo que esos sitios te pidan— no es responsabilidad de esta plataforma. Si un
        enlace deja de llevar a donde decía, repórtalo con el botón de la ficha.
      </p>

      <h2 className="font-heading mt-8 text-2xl">4. El contacto ocurre fuera de la plataforma y bajo tu responsabilidad.</h2>
      <p className="mt-3 text-base">
        No intermediamos, no acompañamos y no respondemos por lo que suceda entre las partes, incluyendo
        incumplimientos, pérdidas, daños o delitos.
      </p>

      {/* ⚠ Aquí iba «4b. Si eliges que una fundación te acompañe», que
          describía el flujo acompañado: entrega en el punto de acopio,
          conversación de tres, y «guardamos tu nombre, tu documento y un
          teléfono, cifrados».

          El ADR 0007 retiró ese flujo entero y borró las tablas. Desde
          entonces esas frases no eran una contradicción con el aviso de
          privacidad: eran falsas. No guardamos ningún documento de nadie —no
          hay ninguna columna de documento en la base— y no hay conversación
          de tres. Ver `docs/PENDIENTES-LEGALES.md`. */}

      <h2 className="font-heading mt-8 text-2xl">5. Recomendaciones de seguridad.</h2>
      <p className="mt-3 text-base">
        No compartas tu dirección exacta en público. Encuéntrate en lugares con gente y de día. Nunca envíes
        dinero por adelantado. Cuéntale a alguien a dónde vas. Si alguien te pide plata, repórtalo. Están
        explicadas una por una en{' '}
        <Link href="/seguridad" className="text-enlace underline underline-offset-4">
          Cómo cuidarte
        </Link>
        .
      </p>

      <h2 className="font-heading mt-8 text-2xl">6. Prohibido.</h2>
      <p className="mt-3 text-base">
        Publicar datos personales de terceros o de menores; pedir o entregar dinero a través de la
        plataforma; ofrecer alojamiento de personas; ofrecer medicamentos de control; suplantar a
        alguien; recolectar datos de otros usuarios. En la ayuda de emergencia queda además prohibido
        ofrecer cuidado de menores o transporte de personas; en el directorio de servicios esos dos
        oficios sí se pueden ofrecer, con las condiciones de la §12.
      </p>

      <h2 className="font-heading mt-8 text-2xl">7. Contenido efímero.</h2>
      <p className="mt-3 text-base">
        Las solicitudes de ayuda se eliminan automáticamente a las 72 horas. Si hay una coordinación abierta con una
        fundación, ese plazo se prorroga solo mientras siga abierta, y nunca más allá de 5 días desde que se
        publicó: al llegar ahí se cierra y se borra igual. No garantizamos conservación ni recuperación de nada.
      </p>
      <p className="mt-3 text-base">
        Las solicitudes de servicio se eliminan a los 15 días, renovables. Las fichas del directorio
        de servicios no se eliminan solas: permanecen hasta que su titular las borre.
      </p>

      <h2 className="font-heading mt-8 text-2xl">8. Servicio &quot;tal como está&quot;.</h2>
      <p className="mt-3 text-base">
        Gratuito, sin garantía de disponibilidad, mantenido con recursos limitados, y puede
        suspenderse o cerrarse en cualquier momento sin previo aviso. En la medida permitida por la ley, el
        operador no responde por daños derivados del uso o de la imposibilidad de uso.
      </p>

      <h2 className="font-heading mt-8 text-2xl">9. Moderación.</h2>
      <p className="mt-3 text-base">
        Podemos eliminar contenido o suspender perfiles sin explicación previa, especialmente si hay riesgo para
        alguien.
      </p>

      <h2 className="font-heading mt-8 text-2xl">10. Ley aplicable.</h2>
      <p className="mt-3 text-base">
        Leyes de la República de Colombia.
      </p>

      <h2 className="font-heading mt-8 text-2xl">11. Contacto.</h2>
      <p className="mt-3 text-base">
        {CORREO_CONTACTO}
      </p>

      <h2 className="font-heading mt-8 text-2xl">12. El directorio de servicios.</h2>
      <p className="mt-3 text-base">
        Es una parte aparte de este sitio, con otra finalidad: que quien vive de su trabajo pueda ser
        encontrado después del sismo. La responsable del tratamiento de esos datos es la misma que
        la del resto del sitio, {RESPONSABLE_SERVICIOS}. Todo lo demás de estos términos sigue
        aplicando.
      </p>
      <p className="mt-3 text-base">
        <strong>Solo conectamos.</strong> {DESLINDE_CALIDAD} El precio lo declara cada proveedor y se
        acuerda directamente entre las partes.
      </p>
      <p className="mt-3 text-base">
        <strong>Qué significan las insignias.</strong> {SOBRE_LAS_INSIGNIAS}
      </p>
      <p className="mt-3 text-base">
        <strong>Calificaciones.</strong> Solo puede calificar quien recibió el código que el proveedor
        entrega al terminar un trabajo, y cada código sirve una sola vez. El proveedor puede responder
        públicamente a cualquier calificación y reportarla. Usar una calificación —o la amenaza de
        ponerla— para presionar a alguien es motivo de eliminación de la cuenta, y hay un botón de
        reporte específico para eso. Moderamos con atención a la discriminación racial o de género.
      </p>
      <p className="mt-3 text-base">
        <strong>Referencias.</strong> Si das el contacto de un cliente anterior, necesitas su
        autorización previa y al darla declaras que la tienes. Ese dato se guarda cifrado, no aparece
        en ninguna página pública y solo lo consulta la fundación para confirmar el servicio.
      </p>
      <p className="mt-3 text-base">
        <strong>Oficios que aquí sí se pueden ofrecer.</strong> A diferencia del resto del sitio, en
        el directorio se admite transporte de personas, trasteos, cuidado de personas y cuidado de
        mascotas. El cuidado de niños, el cuidado de personas dependientes y el transporte de
        pasajeros solo aparecen publicados si el proveedor tiene el teléfono verificado y al menos una
        referencia confirmada. Eso no comprueba su idoneidad ni sus antecedentes: sigue siendo tu
        decisión y tu responsabilidad.
      </p>
      <p className="mt-3 text-base">
        <strong>Oficios que no.</strong> Reconstrucción o revisión estructural de viviendas, salud,
        gas, instalaciones eléctricas y asesoría jurídica no van en el directorio: exigen matrícula y
        se ofrecen en la sección de profesionales.
      </p>
      <p className="mt-3 text-base">
        <strong>Sigue sin haber dinero de por medio.</strong> AquíVe no cobra, no recibe pagos, no
        toma comisión y no tiene pasarela. {NO_PAGUES_POR_ADELANTADO}
      </p>
    </main>
  )
}
