import type { Metadata } from 'next'
import Link from 'next/link'
import {
  HandHeart,
  PackageOpen,
  Stethoscope,
  Briefcase,
  Building2,
  BadgeCheck,
  TriangleAlert,
} from 'lucide-react'
import { RESPONSABLE } from '@/lib/config'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Cómo funciona',
  description:
    'Los pasos de AquíVe según lo que vengas a hacer: buscar un oficio, ofrecer el tuyo, pedir insumos de emergencia, entregarlos o coordinar desde una fundación.',
}

/**
 * El instructivo por rol.
 *
 * Seis roles no caben abiertos en un teléfono, así que van en `<details>`
 * nativo: se pliega sin una línea de JavaScript, el navegador se encarga
 * del teclado y del lector de pantalla, y quien llega buscando lo suyo no
 * tiene que pasar por lo de los otros cinco.
 *
 * ⚠ El orden cambió el 20 de agosto de 2026, y no es cosmético: el
 * directorio de servicios pasó a ser la portada, así que quien busca un
 * oficio es ahora el visitante más probable y va primero. La ayuda de
 * emergencia sigue entera, más abajo, que es donde está su público.
 */

interface Rol {
  id: string
  Icono: typeof HandHeart
  titulo: string
  para: string
  pasos: string[]
  /** Lo que la gente no espera y le cuesta caro no saber. */
  ojo: string
  accion?: { href: string; texto: string }
  abierto?: boolean
}

const ROLES: Rol[] = [
  {
    id: 'buscar-servicio',
    Icono: Stethoscope,
    titulo: 'Si necesitas que alguien te haga un trabajo',
    para: 'No hace falta cuenta ni dar tus datos.',
    pasos: [
      'Busca en el directorio por oficio, municipio y zona. Los filtros viven en la dirección, así que puedes pegar el enlace de «modistas en la comuna 3» en un grupo de WhatsApp.',
      'Abre la ficha de quien te sirva. Ahí están sus precios desde, sus horarios, sus medios de pago y lo que otras personas dijeron de su trabajo.',
      'Escríbele por WhatsApp o llámalo. El contacto ocurre por fuera: la plataforma no ve tu número ni tu conversación.',
      'Si no encuentras a nadie, publica lo que necesitas en «Solicitudes». Quien tenga cómo hacerlo te escribe.',
      'Cuando te terminen el trabajo, pídele el código y califícalo. Solo puede calificar quien tiene ese código, y sirve una sola vez.',
    ],
    ojo: 'Acuerda el precio antes de empezar y paga cuando el trabajo esté hecho. Nadie de AquíVe te va a pedir plata por adelantado, y quien te la pida no es de aquí.',
    accion: { href: '/', texto: 'Ver el directorio' },
    abierto: true,
  },
  {
    id: 'ofrecer-oficio',
    Icono: Briefcase,
    titulo: 'Si vives de un oficio',
    para: 'Comida, arreglos, trasteos, aseo, reparaciones, cuidado.',
    pasos: [
      'Publica tu ficha: tu nombre, tu teléfono, qué haces, dónde y cuánto cobras desde. Puedes entrar con Google o, si no tienes cuenta, pedir en un punto de ' +
        RESPONSABLE +
        ' que te registren y te den tu propio enlace.',
      'Alguien de ' +
        RESPONSABLE +
        ' marca tu número y confirma que contestas tú. Hasta que eso pase, tu ficha no se ve en el directorio aunque esté completa.',
      'Si quieres, deja la referencia de un cliente anterior. Para algunos oficios —cuidado de niños, cuidado de personas dependientes, transporte de pasajeros— hace falta para poder publicarlos.',
      'Cuando termines un trabajo, dale a esa persona el código que genera tu ficha. Es lo único con lo que puede calificarte.',
      'Tu ficha no caduca. Se queda mientras la quieras y la borras cuando quieras, desde tu propio enlace.',
    ],
    ojo: 'Lo único que comprobamos es que tu teléfono contesta. No es una verificación de identidad y así se lo decimos a quien te contacte: no miramos tu cédula, ni tu experiencia, ni tus antecedentes.',
    accion: { href: '/servicios/soy-proveedor', texto: 'Publicar mi ficha' },
  },
  {
    id: 'pedir',
    Icono: HandHeart,
    titulo: 'Si necesitas insumos de la emergencia',
    para: 'No hace falta cuenta ni dar tus datos.',
    pasos: [
      'Toca «Necesito ayuda» y elige tu municipio y tu barrio. No pedimos la dirección exacta.',
      'Escoge de la lista qué te hace falta y cuánto. Si algo no está, puedes proponerlo hasta tres veces.',
      'Si quieres, agrega una nota corta y marca «Puedo recoger» cuando puedas ir a buscarlo. Así no tienen que preguntártelo después.',
      'Si en tu municipio hay una fundación, te preguntamos si prefieres que ella coordine la entrega. Es opcional: tu solicitud se publica igual y sin ningún dato tuyo.',
      'Guarda el enlace que te damos. Desde ahí ves quién respondió y también quién tiene lo que pediste, y decides tú a quién le escribes.',
    ],
    ojo: 'Ese enlace es la única forma de volver a tu solicitud, y no podemos recuperarlo: no guardamos a quién pertenece. Mándatelo por WhatsApp a ti mismo o guarda la captura del código.',
    accion: { href: '/publicar', texto: 'Publicar una solicitud' },
  },
  {
    id: 'ofrecer',
    Icono: PackageOpen,
    titulo: 'Si quieres entregar insumos',
    para: 'Entras con Google. De esa cuenta solo guardamos un identificador: el correo se descarta.',
    pasos: [
      'Crea tu perfil: cómo te llamas, en qué municipios puedes ayudar y una forma de contacto pública.',
      'Marca «Puedo trasladarme a entregar» si puedes llevar las cosas. Aparece en tu ficha y viene marcado cuando respondas.',
      'Si quieres, escribe qué tienes. Es opcional, pero es lo que hace que te avisemos cuando alguien pida justo eso, y lo que te pone delante de quien lo necesita.',
      'En «Ayudas» mira quién está pidiendo, o marca lo que puedes dar y te salen las solicitudes que lo piden.',
      'Responde diciendo qué puedes aportar. Quien pidió ayuda ve tu respuesta y te escribe si le sirve: el primer mensaje lo da esa persona, no tú.',
    ],
    ojo: 'Nunca envíes nada por adelantado ni pidas plata. Si la solicitud tiene fundación, la entrega ocurre en su punto de acopio y la conversación pasa por aquí, con los tres a la vez.',
    accion: { href: '/registro', texto: 'Crear mi perfil' },
  },
  {
    id: 'servicios',
    Icono: BadgeCheck,
    titulo: 'Si eres profesional con matrícula',
    para: 'Ingeniería, arquitectura, psicología, salud o derecho.',
    pasos: [
      'Crea tu perfil y marca «Servicios profesionales». Puedes marcar también insumos: no es una cosa o la otra.',
      'Indica tu profesión, la entidad de tu matrícula (COPNIA, CPNAA, COLPSIC, ReTHUS o SIRNA) y el número.',
      'Elige qué servicios puedes prestar de la lista.',
      'Una persona consulta tu número en el registro de tu entidad, a mano. No es automático y puede tardar.',
      'Mientras tanto tu ficha se publica con un aviso de «Sin verificar» bien visible, y cualquiera puede verlo.',
    ],
    ojo: 'El sello verificado significa solo que ese número aparece en el registro. No dice nada sobre tu experiencia ni te respalda, y así se lo explicamos a quien te contacte.',
    accion: { href: '/registro', texto: 'Registrar mi matrícula' },
  },
  {
    id: 'fundacion',
    Icono: Building2,
    titulo: 'Si trabajas en una fundación aliada',
    para: 'No se entra por aquí: hace falta el enlace que reparte tu coordinador.',
    pasos: [
      'Un administrador da de alta la organización después de mirar su certificado del RUES y su NIT. Las organizaciones no se registran solas.',
      'El coordinador entra con su enlace y, desde «Mi equipo», reparte invitaciones al resto: un código con QR, con fecha de vencimiento y número de usos.',
      'Quien llega con código queda activo de una vez. Quien llega sin él espera aprobación y mientras tanto no ve nada.',
      'En «Conversaciones» aparecen los hilos. Alguien tiene que hacerse cargo de cada uno: hasta que eso pase, nadie puede escribir.',
      'En «Solicitudes por atender» está lo que acompaña tu organización. Si lo tienes en la bodega, ábrelo con «Lo entregamos nosotros»; si lo tiene otra persona, invítala a coordinar.',
      'Llama a los proveedores que esperan verificación. Hasta que alguien marque su número, su ficha no se ve en el directorio.',
      'En el acopio, registra qué entregaste y descarga la planilla en ese momento. Desde ahí la custodia es de la fundación.',
    ],
    ojo: 'Ver el nombre de alguien exige un permiso que un coordinador otorga persona por persona, y cada consulta queda registrada con quién fue y por qué. En el chat no se pueden intercambiar teléfonos: la coordinación ocurre aquí para que quede constancia.',
  },
]

const PARTES = [
  {
    Icono: Stethoscope,
    titulo: 'El directorio de servicios',
    texto:
      'Gente que vive de su oficio y quiere que la encuentren. Estas fichas no se borran solas: se quedan mientras la persona quiera. Es lo que ves al entrar.',
  },
  {
    Icono: HandHeart,
    titulo: 'La ayuda de emergencia',
    texto:
      'Quien necesita insumos tras el sismo del 10 de agosto de 2026 y quien puede darlos. Las solicitudes se borran solas a las 72 horas, y esta parte dejará de operar cuando deje de ser útil.',
  },
]

export default function ComoFuncionaPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading text-3xl leading-tight">Cómo funciona</h1>
      <p className="mt-3 text-base text-muted-foreground">
        AquíVe conecta, en Colombia, a quien necesita algo con quien puede
        darlo. Son dos cosas distintas bajo el mismo techo, y funcionan
        distinto.
      </p>

      {/* Las dos partes antes que los roles: sin esto, quien llega por el
          directorio no entiende por qué hay un tablero de emergencia, y
          quien llega por la emergencia no entiende por qué la portada
          enseña modistas. */}
      <ul className="lista-escalonada mt-6 grid gap-3 sm:grid-cols-2">
        {PARTES.map(({ Icono, titulo, texto }) => (
          <li key={titulo} className="animar-entrada rounded-2xl bg-card p-4 shadow-canto">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Icono className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-base font-bold">{titulo}</h2>
            <p className="mt-1 text-base text-muted-foreground">{texto}</p>
          </li>
        ))}
      </ul>

      <h2 className="font-heading mt-8 text-2xl">Abre lo tuyo</h2>
      <div className="mt-3 space-y-3">
        {ROLES.map(({ id, Icono, titulo, para, pasos, ojo, accion, abierto }) => (
          <details
            key={id}
            id={id}
            open={abierto}
            className="group rounded-2xl bg-card shadow-canto"
          >
            {/* `list-none` mata el triangulito del navegador, que en Safari
                se sale de la caja. La flecha la pone el `after` de abajo. */}
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-4 after:ml-auto after:text-muted-foreground after:transition-transform after:content-['▾'] group-open:after:rotate-180">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icono className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="font-heading block text-xl leading-tight">{titulo}</span>
                <span className="block text-sm text-muted-foreground">{para}</span>
              </span>
            </summary>

            <div className="border-t border-border p-4">
              {/* Numerados porque son una secuencia de verdad: el orden es
                  la información. No es decoración. */}
              <ol className="space-y-3">
                {pasos.map((paso, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
                    >
                      {i + 1}
                    </span>
                    <span className="text-base">{paso}</span>
                  </li>
                ))}
              </ol>

              <p className="mt-4 flex gap-2 rounded-lg bg-accent p-3 text-base text-accent-foreground">
                <TriangleAlert className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
                <span>{ojo}</span>
              </p>

              {accion && (
                <Button
                  className="mt-4 w-full"
                  nativeButton={false}
                  render={<Link href={accion.href} />}
                >
                  {accion.texto}
                </Button>
              )}
            </div>
          </details>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="font-heading text-2xl">Qué comprobamos, y qué no</h2>
        <p className="mt-3 text-base">
          Una sola cosa, y solo en el directorio de oficios:{' '}
          <strong>que el teléfono contesta.</strong> Alguien de {RESPONSABLE}{' '}
          marca el número y confirma que contesta esa persona. Hasta que eso
          pase, la ficha no se ve.
        </p>
        <p className="mt-3 text-base">
          Eso <strong>no es una verificación de identidad</strong> y no es una
          recomendación. No miramos cédulas, ni experiencia, ni antecedentes, ni
          la calidad de un trabajo. En la ayuda de emergencia no comprobamos
          nada de nadie, y lo decimos encima de cada lista.
        </p>
        <p className="mt-3 text-base">
          La única excepción es la matrícula de un profesional, y ahí el sello
          dice solo que ese número aparece en el registro de su entidad.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-2xl">Qué guardamos de ti</h2>
        <ul className="mt-3 space-y-2 text-base">
          <li>
            <strong>Si pides algo, nada.</strong> Ni tu nombre, ni tu teléfono,
            ni tu dirección: solo el municipio, el barrio y qué necesitas.
          </li>
          <li>
            <strong>Si ofreces algo, lo que decidas publicar</strong>, y es
            público porque esa es la idea: tu nombre, tu contacto y lo que
            haces.
          </li>
          <li>
            <strong>No pedimos ni guardamos números de documento.</strong> Si
            una fundación necesita comprobar tu identidad para entregarte algo,
            lo hace mirando tu cédula en persona.
          </li>
          <li>
            Cada vez que alguien de una fundación consulta datos tuyos queda
            registrado quién fue, cuándo y con qué motivo. Nunca qué vio.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-2xl">Cómo borrar lo tuyo</h2>
        <ul className="mt-3 space-y-2 text-base">
          <li>
            Tu solicitud de ayuda se borra sola a las 72 horas, o antes si la
            borras tú desde tu enlace.
          </li>
          <li>Tu perfil de quien ofrece, desde «Lo mío», en los ajustes.</li>
          <li>
            Tu ficha del directorio, desde tu propio enlace, y se va con las
            calificaciones que hayas recibido.
          </li>
        </ul>
        <p className="mt-3 text-base text-muted-foreground">
          Todo está en el{' '}
          <Link href="/privacidad" className="text-enlace underline underline-offset-4">
            aviso de privacidad
          </Link>
          , con más detalle.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-2xl">Lo que vale para todos</h2>
        <ul className="mt-3 space-y-2 text-base">
          <li>
            El contacto ocurre por fuera de la plataforma. Nunca vemos tu
            teléfono ni tus conversaciones, salvo en el chat de una entrega que
            coordina una fundación, que existe precisamente para que quede
            constancia.
          </li>
          <li>
            No pedimos ni movemos dinero, y nadie debería pedírtelo por aquí.{' '}
            <Link href="/seguridad" className="text-enlace underline underline-offset-4">
              Cómo cuidarte
            </Link>
            .
          </li>
          <li>
            Puedes instalar AquíVe en tu teléfono desde el icono de descarga del
            encabezado. Es la misma página, sin tienda de aplicaciones.
          </li>
        </ul>

        {/* Fuera de la lista y en rojo pastel con texto negro (5,67:1): en
            una viñeta más, entre «puedes instalar la aplicación» y el aviso
            de privacidad, la línea que hay que recordar de verdad se leía
            como una nota al pie. */}
        <div className="mt-4 rounded-2xl bg-familia-rojo p-4 text-foreground">
          <p className="font-heading text-base">Si hay riesgo para alguien ahora</p>
          <p className="mt-2 text-base">
            Eso no se publica aquí: es el <strong>123</strong>. Esta plataforma
            no reemplaza a las autoridades ni atiende urgencias.
          </p>
        </div>
      </section>
    </main>
  )
}
