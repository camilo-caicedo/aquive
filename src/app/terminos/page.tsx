import { RESPONSABLE, CORREO_CONTACTO, FECHA_LEGALES } from '@/lib/config'

export default function TerminosPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">Términos de uso de AquíVe</h1>
      <p className="mt-3 text-base">Última actualización: {FECHA_LEGALES}</p>

      <h2 className="mt-6 text-xl font-bold">1. Qué es esto.</h2>
      <p className="mt-3 text-base">
        Un tablón de anuncios gratuito que permite a personas afectadas por el sismo publicar qué artículos
        necesitan, y a otras personas ofrecer ayuda. Es un proyecto personal, gratuito y sin ánimo de lucro,
        operado por {RESPONSABLE} a título individual. No hay empresa ni organización detrás.
      </p>

      <h2 className="mt-6 text-xl font-bold">2. Qué NO es.</h2>
      <p className="mt-3 text-base">
        No somos una entidad de socorro, ni una ONG, ni una autoridad. No entregamos ayuda, no transportamos, no
        almacenamos ni distribuimos nada. No reemplazamos a la UNGRD, la Cruz Roja, la Defensa Civil ni a tu
        alcaldía. Para emergencias: 123.
      </p>

      <h2 className="mt-6 text-xl font-bold">3. No verificamos a las personas.</h2>
      <p className="mt-3 text-base">
        Con excepción de la matrícula profesional de quienes se registran como profesionales, no verificamos la
        identidad, los antecedentes ni las intenciones de nadie. Un sello de matrícula verificada significa
        únicamente que ese número aparece en el registro correspondiente.
      </p>

      <h2 className="mt-6 text-xl font-bold">4. El contacto ocurre fuera de la plataforma y bajo tu responsabilidad.</h2>
      <p className="mt-3 text-base">
        No intermediamos, no acompañamos y no respondemos por lo que suceda entre las partes, incluyendo
        incumplimientos, pérdidas, daños o delitos.
      </p>

      <h2 className="mt-6 text-xl font-bold">5. Recomendaciones de seguridad.</h2>
      <p className="mt-3 text-base">
        No compartas tu dirección exacta en público. Encuéntrate en lugares con gente. Nunca envíes dinero por
        adelantado. Si alguien te pide plata, repórtalo.
      </p>

      <h2 className="mt-6 text-xl font-bold">6. Prohibido.</h2>
      <p className="mt-3 text-base">
        Publicar datos personales de terceros o de menores; pedir o entregar dinero; ofrecer alojamiento de
        personas, cuidado de menores o transporte de personas; ofrecer medicamentos de control; suplantar a
        alguien; usar la plataforma con fines comerciales o para recolectar datos.
      </p>

      <h2 className="mt-6 text-xl font-bold">7. Contenido efímero.</h2>
      <p className="mt-3 text-base">
        Las solicitudes se eliminan automáticamente a las 72 horas. No garantizamos conservación ni recuperación
        de nada.
      </p>

      <h2 className="mt-6 text-xl font-bold">8. Servicio &quot;tal como está&quot;.</h2>
      <p className="mt-3 text-base">
        Gratuito, sin garantía de disponibilidad, mantenido por una sola persona en su tiempo libre, y puede
        suspenderse o cerrarse en cualquier momento sin previo aviso. En la medida permitida por la ley, el
        operador no responde por daños derivados del uso o de la imposibilidad de uso.
      </p>

      <h2 className="mt-6 text-xl font-bold">9. Moderación.</h2>
      <p className="mt-3 text-base">
        Podemos eliminar contenido o suspender perfiles sin explicación previa, especialmente si hay riesgo para
        alguien.
      </p>

      <h2 className="mt-6 text-xl font-bold">10. Ley aplicable.</h2>
      <p className="mt-3 text-base">
        Leyes de la República de Colombia.
      </p>

      <h2 className="mt-6 text-xl font-bold">11. Contacto.</h2>
      <p className="mt-3 text-base">
        {CORREO_CONTACTO}
      </p>
    </main>
  )
}
