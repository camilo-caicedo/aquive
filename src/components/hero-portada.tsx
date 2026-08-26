import Link from 'next/link'
import { PlusCircle, HandHeart, ShieldCheck, ChevronDown, Timer, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlegableRecordado } from '@/components/plegable-recordado'

/**
 * Lo que dice qué es AquíVe, en la portada.
 *
 * ⚠ Vive en un componente propio porque la portada cambió de contenido —el
 * directorio de servicios ocupó el sitio del tablero de solicitudes— y esto
 * NO se podía mover con el tablero: la revisión de marca de Google exige
 * que la portada describa para qué sirve la aplicación, y ya rechazó la
 * verificación dos veces por eso. El texto sigue palabra por palabra el de
 * `metadata.description`, y los dos tienen que cambiar en el mismo commit.
 *
 * Ver el comentario de `src/app/page.tsx` y la Fase 8 del plan.
 */
export function HeroPortada() {
  return (
    <section className="animar-entrada rounded-2xl bg-secondary p-5 sm:p-8">
      {/* El nombre va en el encabezado principal, no solo en la barra de
          arriba. Google rechazó la verificación de la marca dos veces por
          esto: su revisor compara el nombre de la pantalla de
          consentimiento con el de la portada, y «Pide lo que necesitas»
          no contenía ninguno. */}
      <h1 className="font-heading text-3xl leading-tight sm:text-4xl">
        AquíVe: pide lo que necesitas, sin dar tus datos.
      </h1>
      {/* Y qué ES esto, dicho de frente. Lo pide la misma revisión —una
          portada tiene que describir para qué sirve la aplicación— pero
          hace falta igual: alguien que llega por un volante pegado en un
          albergue no tiene de dónde deducirlo. */}
      <p className="mt-3 max-w-prose text-base">
        Una red de vecinos donde quien necesita un servicio encuentra a quien lo ofrece, sin intermediarios. Sin comisiones, sin intermediar el pago.
      </p>
      <p className="mt-2 max-w-prose text-base text-muted-foreground">
        Pedir no exige cuenta. No pedimos tu nombre, tu teléfono ni tu
        dirección: solo el barrio y qué necesitas.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          nativeButton={false}
          render={<Link href="/publicar" />}
        >
          <PlusCircle className="size-5" aria-hidden="true" />
          Necesito ayuda
        </Button>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          <HandHeart className="size-5" aria-hidden="true" />
          Quiero ayudar
        </Button>
      </div>
      {/* Los tres avisos que antes ocupaban media portada, plegados.
          Abierto de entrada y servido siempre abierto: dentro va lo que
          la revisión de la marca de Google lee para saber para qué es la
          cuenta, así que no puede salir del HTML. Ver
          `PlegableRecordado`. */}
      <PlegableRecordado
        id="portada-avisos"
        className="shadow-canto group mt-4 rounded-2xl bg-card p-4"
      >
        {/* El escudo a la izquierda y el galón a la derecha, no los dos
            del mismo lado: el escudo dice de qué habla esto y el galón
            dice que se abre, y juntos se leían como un solo control. */}
        <summary className="flex min-h-12 cursor-pointer list-none items-start gap-2.5 text-base font-medium [&::-webkit-details-marker]:hidden">
          <ShieldCheck
            className="size-5 shrink-0 translate-y-0.5 text-enlace"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            Qué se borra, qué se queda y para qué es la cuenta
          </span>
          <ChevronDown
            className="size-5 shrink-0 translate-y-0.5 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        {/* ⚠ Antes la portada decía «todo se borra solo a las 72 horas»,
            y desde que existe el directorio de servicios eso ya no es
            cierto de todo. Si la diferencia no se entiende aquí, la
            existencia del directorio desmiente la promesa de borrado. */}
        <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
          <Timer className="size-4 shrink-0 translate-y-0.5 text-enlace" aria-hidden="true" />
          Las solicitudes de insumos se borran solas a las 72 horas, con todo
          lo que llevan dentro. El directorio de servicios es lo contrario:
          esas fichas se quedan mientras la persona quiera, y las borra
          cuando quiera.
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 translate-y-0.5 text-enlace" aria-hidden="true" />
          El contacto ocurre por fuera de la plataforma. Nunca vemos tu
          teléfono ni tus conversaciones.
        </p>
        {/* Quién entra con Google y para qué, dicho en la portada. Lo pide
            la revisión de la marca OAuth —el revisor evalúa el cliente, no
            la aplicación, y sin esto no hay dónde leer para qué sirve ese
            botón—, pero está aquí porque de todos modos es lo que quiere
            saber quien duda antes de tocarlo. Y es cierto: el callback usa
            solo `user.id` y descarta el correo. */}
        <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
          <LogIn className="size-4 shrink-0 translate-y-0.5 text-enlace" aria-hidden="true" />
          Quien pide ayuda no necesita cuenta. Quien quiere ayudar entra con
          su cuenta de Google para poder responder solicitudes y sostener su
          perfil; de esa cuenta solo guardamos un identificador interno, y el
          correo no se almacena.
        </p>

        {/* Las dos salidas, al pie de lo que explican. Estaban solo en el
            pie de página, a una portada entera de distancia de la única
            pantalla donde alguien se hace estas preguntas. */}
        <p className="mt-3 text-sm">
          <Link href="/como-funciona" className="text-enlace underline underline-offset-4">
            Cómo funciona
          </Link>
          {' · '}
          <Link href="/privacidad" className="text-enlace underline underline-offset-4">
            Aviso de privacidad
          </Link>
        </p>
      </PlegableRecordado>
    </section>
  )
}
