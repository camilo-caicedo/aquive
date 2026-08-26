import Image from 'next/image'
import Link from 'next/link'
import { HandHeart, Search } from 'lucide-react'

import isotipo from '@/../docs/marca/isotipo-carrito.png'

/**
 * Pantalla 01. Lo primero que ve quien llega sin sesión.
 *
 * ⚠ NO ES UN MURO. Lo dice ella misma al pie: buscar y pedir no necesitan
 * cuenta, y la tarjeta grande lleva directo al directorio. Es un desvío en el
 * camino, no un peaje — si alguna vez se convierte en una pantalla que hay
 * que superar para ver el directorio, deja de cumplir lo que promete.
 *
 * ⚠ EL h1 Y EL PÁRRAFO SON LA VERIFICACIÓN DE MARCA DE GOOGLE.
 *
 * `src/components/hero-portada.tsx` y `src/app/layout.tsx` documentan que la
 * revisión de Google **ya rechazó el proyecto dos veces**: su revisor compara
 * el nombre de la pantalla de consentimiento con el de la portada, y exige que
 * la portada describa para qué sirve la aplicación.
 *
 * Como esta pantalla pasa a ser lo que se sirve en `/` para quien no tiene
 * sesión —y un rastreador nunca la tiene—, el nombre y la frase se copian de
 * `HeroPortada` PALABRA POR PALABRA. Esa frase vive idéntica en cinco sitios
 * (`hero-portada.tsx`, `metadata.description`, `openGraph.description`,
 * `DATOS_ESTRUCTURADOS.description` y el README). Si cambias una, cambian las
 * seis en el mismo commit, o la verificación vuelve a caer.
 */
export function Bienvenida() {
  return (
    <main className="mx-auto flex max-w-lg flex-col px-4 py-8">
      {/* El isotipo es un PNG sin canal alfa: trae fondo blanco sólido. Va
          dentro de una tarjeta blanca deliberada y no suelto sobre el crema,
          donde se vería un cuadrado recortado. Cuando llegue el SVG, esto se
          simplifica. */}
      <div className="shadow-canto mx-auto w-40 rounded-2xl bg-card p-2">
        <Image
          src={isotipo}
          alt=""
          width={160}
          height={160}
          priority
          className="h-auto w-full"
        />
      </div>

      <h1 className="font-heading mt-6 text-center text-3xl leading-tight">
        AquíVe: pide lo que necesitas, sin dar tus datos.
      </h1>

      <p className="mt-3 text-center text-base">
        AquíVe es una plataforma gratuita que conecta, en Colombia, a quien
        necesita algo con quien puede darlo: insumos que alguien entrega sin
        cobrar, servicios de profesionales con matrícula, y el trabajo de gente
        que vive de su oficio.
      </p>

      <h2 className="font-heading mt-8 text-2xl">¿Qué te trae hoy aquí?</h2>

      {/* Dos caminos y ninguno preseleccionado. El primero no pide nada; el
          segundo dice de frente que lleva a entrar con Google, para que nadie
          lo toque creyendo que sigue mirando. */}
      <Link
        href="/directorio"
        className="shadow-cartel-azul mt-4 block rounded-2xl bg-card p-5 transition-transform hover:-translate-y-0.5"
      >
        <span className="flex items-center gap-3">
          <Search className="size-6 shrink-0" aria-hidden="true" />
          <span className="font-heading text-xl">Necesito un servicio</span>
        </span>
        <span className="mt-2 block text-base text-muted-foreground">
          Busca en tu zona, mira quién está disponible y escríbele. Sin cuenta.
        </span>
      </Link>

      <Link
        href="/login"
        className="shadow-cartel-amarillo mt-3 block rounded-2xl bg-card p-5 transition-transform hover:-translate-y-0.5"
      >
        <span className="flex items-center gap-3">
          <HandHeart className="size-6 shrink-0" aria-hidden="true" />
          <span className="font-heading text-xl">Ofrezco mi trabajo</span>
        </span>
        <span className="mt-2 block text-base text-muted-foreground">
          Entra con Google, publica tu oficio y aparece cuando alguien busque
          cerca.
        </span>
      </Link>

      {/* La salida honesta, y no en letra pequeña: quien viene a pedir ayuda
          de emergencia o a mirar el muro no necesita ninguna de las dos
          tarjetas de arriba. */}
      <p className="mt-6 text-center text-base text-muted-foreground">
        Buscar y pedir no necesita cuenta.{' '}
        <Link href="/login" className="text-enlace underline underline-offset-4">
          Entrar con Google
        </Link>
      </p>

      <p className="mt-2 text-center text-base">
        <Link href="/ayudas" className="text-enlace underline underline-offset-4">
          ¿Necesitas ayuda de emergencia?
        </Link>
      </p>
    </main>
  )
}
