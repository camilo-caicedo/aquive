import type { Metadata } from 'next'
import Link from 'next/link'
import {
  HandHeart,
  PackageOpen,
  Stethoscope,
  Building2,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Cómo funciona',
  description:
    'Los pasos de AquíVe según lo que vengas a hacer: pedir insumos, ofrecerlos, ofrecer un servicio profesional o coordinar entregas desde una fundación.',
}

/**
 * El instructivo por rol.
 *
 * Cuatro roles no caben abiertos en un teléfono, así que van en `<details>`
 * nativo: se pliega sin una línea de JavaScript, el navegador se encarga
 * del teclado y del lector de pantalla, y quien llega buscando lo suyo no
 * tiene que pasar por lo de los otros tres.
 *
 * Abierto viene solo el primero. Quien pide ayuda es quien llega con
 * prisa, quien más probablemente entra desde un albergue y quien menos
 * puede permitirse un toque de más.
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
    id: 'pedir',
    Icono: HandHeart,
    titulo: 'Si necesitas insumos',
    para: 'No hace falta cuenta ni dar tus datos.',
    pasos: [
      'Toca «Necesito ayuda» y elige tu municipio y tu barrio. No pedimos la dirección exacta.',
      'Escoge de la lista qué te hace falta y cuánto. Si algo no está, puedes proponerlo hasta tres veces.',
      'Si quieres, agrega una nota corta y marca «Puedo recoger» cuando puedas ir a buscarlo. Así no tienen que preguntártelo después.',
      'Si en tu municipio hay una fundación, te preguntamos si prefieres que ella coordine la entrega. Es opcional: tu solicitud se publica igual y sin ningún dato tuyo.',
      'Guarda el enlace que te damos. Cuando alguien responda, entras por ahí y decides tú a quién le escribes.',
    ],
    ojo: 'Ese enlace es la única forma de volver a tu solicitud, y no podemos recuperarlo: no guardamos a quién pertenece. Mándatelo por WhatsApp a ti mismo o guarda la captura del código.',
    accion: { href: '/publicar', texto: 'Publicar una solicitud' },
    abierto: true,
  },
  {
    id: 'ofrecer',
    Icono: PackageOpen,
    titulo: 'Si quieres entregar insumos',
    para: 'Entras con Google. De esa cuenta solo guardamos un identificador: el correo se descarta.',
    pasos: [
      'Crea tu perfil: cómo te llamas, en qué municipios puedes ayudar y una forma de contacto pública.',
      'Marca «Puedo trasladarme a entregar» si puedes llevar las cosas. Aparece en tu ficha y viene marcado cuando respondas.',
      'Si quieres, escribe qué tienes. Es opcional, pero es lo que hace que te avisemos cuando alguien pida justo eso.',
      'Mira el tablero, abre una solicitud y responde diciendo qué puedes aportar.',
      'Espera. Quien pidió ayuda ve tu respuesta y te escribe si le sirve: el primer mensaje lo da esa persona, no tú.',
    ],
    ojo: 'Nunca envíes nada por adelantado ni pidas plata. Si la solicitud tiene fundación, la entrega ocurre en su punto de acopio y la conversación pasa por aquí, con los tres a la vez.',
    accion: { href: '/registro', texto: 'Crear mi perfil' },
  },
  {
    id: 'servicios',
    Icono: Stethoscope,
    titulo: 'Si ofreces un servicio profesional',
    para: 'Ingeniería, arquitectura, psicología, salud o derecho, con matrícula.',
    pasos: [
      'Crea tu perfil y elige «Servicios profesionales» en vez de insumos.',
      'Indica tu profesión, la entidad de tu matrícula (COPNIA, CPNAA, COLPSIC, ReTHUS o SIRNA) y el número.',
      'Elige qué servicios puedes prestar de la lista.',
      'Una persona revisa tu matrícula a mano contra el registro de tu entidad. No es automático y puede tardar.',
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
      'Un administrador de AquíVe da de alta la organización después de mirar su certificado del RUES y su NIT. Las organizaciones no se registran solas.',
      'El coordinador entra con su enlace y, desde «Mi equipo», reparte invitaciones al resto: un código con QR, con fecha de vencimiento y número de usos.',
      'Quien llega con código queda activo de una vez. Quien llega sin él espera aprobación y mientras tanto no ve nada.',
      'En «Conversaciones» aparecen los hilos. Alguien tiene que hacerse cargo de cada uno: hasta que eso pase, nadie puede escribir.',
      'En «Solicitudes por atender» está lo que acompaña tu organización. Si lo tienes en la bodega, ábrelo con «Lo entregamos nosotros»; si lo tiene otra persona, invítala a coordinar.',
      'En el acopio, registra qué entregaste y descarga la planilla en ese momento. Desde ahí la custodia es de la fundación.',
    ],
    ojo: 'Ver el nombre y el documento de alguien exige un permiso que un coordinador otorga persona por persona, y cada consulta queda registrada con quién fue y por qué. En el chat no se pueden intercambiar teléfonos: la coordinación ocurre aquí para que quede constancia.',
  },
]

export default function ComoFuncionaPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading text-3xl leading-tight">Cómo funciona</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Depende de a qué vengas. Abre lo tuyo.
      </p>

      <div className="mt-6 space-y-3">
        {ROLES.map(({ id, Icono, titulo, para, pasos, ojo, accion, abierto }) => (
          <details
            key={id}
            id={id}
            open={abierto}
            className="group rounded-xl border border-border bg-card"
          >
            {/* `list-none` mata el triangulito del navegador, que en Safari
                se sale de la caja. La flecha la pone el `after` de abajo. */}
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-4 after:ml-auto after:text-muted-foreground after:transition-transform after:content-['▾'] group-open:after:rotate-180">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icono className="size-5" aria-hidden="true" />
              </span>
              <span>
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
        <h2 className="font-heading text-2xl">Lo que vale para todos</h2>
        <ul className="mt-3 space-y-2 text-base">
          <li>
            Las solicitudes se borran solas a las 72 horas. Se pueden renovar en
            un toque o borrar antes.
          </li>
          <li>
            No verificamos a quien publica ni a quien responde. Confirma lo que
            puedas antes de acordar una entrega y prefiere lugares públicos:{' '}
            <Link href="/seguridad" className="underline">
              Cómo cuidarte
            </Link>
            .
          </li>
          <li>
            No pedimos ni movemos dinero, y nadie debería pedírtelo por aquí.
          </li>
          <li>
            Para emergencias, 123. Esta plataforma no reemplaza a las
            autoridades.
          </li>
        </ul>
      </section>
    </main>
  )
}
