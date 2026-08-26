import Image from 'next/image'
import Link from 'next/link'

import isotipo from '@/../docs/marca/isotipo-carrito.png'

/**
 * Pantalla 01. Lo primero que ve quien llega sin sesión.
 *
 * ⚠ NO ES UN MURO. Lo dice ella misma al pie: buscar y pedir no necesitan
 * cuenta, y la tarjeta grande lleva directo al directorio. Es un desvío en el
 * camino, no un peaje.
 *
 * ⚠ VA SIN CROMO: sin encabezado, sin barra inferior y sin pie. Lo hace el
 * atributo `data-sin-cromo` con una regla de `globals.css`, no estado de
 * cliente, para que ya sea correcto en la primera pintada del servidor.
 *
 * No es estética. Esta pantalla ES la presentación de la aplicación —dice
 * cómo se llama y qué hace—, así que un encabezado repitiendo el nombre
 * encima sobra, y una barra inferior ofrece cuatro destinos a quien todavía
 * no ha decidido si entra. La pantalla tiene dos caminos y son las tarjetas.
 *
 * ⚠ EL NOMBRE Y LA DESCRIPCIÓN SON LA VERIFICACIÓN DE MARCA DE GOOGLE.
 *
 * `src/app/layout.tsx` documenta que la revisión ya rechazó el proyecto dos
 * veces: su revisor compara el nombre de la pantalla de consentimiento con el
 * de la portada, y exige que la portada describa para qué sirve la
 * aplicación. Como un rastreador nunca trae sesión, para Google `/` ES esta
 * pantalla.
 *
 * El nombre va como texto en la píldora —no como imagen— y la frase de abajo
 * es la que vive idéntica en `metadata.description`, `openGraph.description`,
 * `DATOS_ESTRUCTURADOS.description` y el README. Si cambias una, cambian las
 * cinco en el mismo commit.
 */
export function Bienvenida() {
  return (
    <div data-sin-cromo className="min-h-dvh">
      {/* Los cuatro gajos de la sombrilla, arriba del todo. Es lo que hace
          que la pantalla se reconozca antes de leer una palabra. Decorativa:
          no informa nada que no esté escrito debajo. */}
      <div className="flex h-2 w-full" aria-hidden="true">
        <span className="bg-familia-azul flex-1" />
        <span className="bg-familia-amarillo flex-1" />
        <span className="bg-familia-verde flex-1" />
        <span className="bg-familia-rojo flex-1" />
      </div>

      <main className="mx-auto flex max-w-md flex-col px-5 py-8">
        {/* El isotipo en círculo. El PNG no tiene canal alfa —trae fondo
            blanco sólido— así que el círculo blanco no es un adorno: es lo
            que evita que se vea un cuadrado recortado sobre el crema.
            Cuando llegue el SVG, esto se simplifica. */}
        <div className="shadow-canto mx-auto size-40 overflow-hidden rounded-full bg-card p-3">
          <Image
            src={isotipo}
            alt=""
            width={160}
            height={160}
            priority
            className="h-full w-full object-contain"
          />
        </div>

        {/* El nombre, en píldora lima con sombra de tinta. Es TEXTO y no una
            imagen: el revisor de Google lee el DOM, y una marca dibujada no
            se puede comparar con el nombre de la pantalla de consentimiento. */}
        <p className="mx-auto -mt-3">
          <span className="bg-primary text-primary-foreground shadow-boton font-heading inline-flex items-center rounded-full px-5 py-2 text-xl tracking-[0.08em] uppercase">
            Aquí Ve
          </span>
        </p>

        <h1 className="font-heading mt-6 text-center text-4xl leading-[1.05]">
          ¿Qué te trae
          <br />
          hoy aquí?
        </h1>

        <p className="mt-4 text-center text-base text-muted-foreground">
          Una red de vecinos donde quien necesita un servicio encuentra a quien
          lo ofrece, sin intermediarios. Sin comisiones, sin intermediar el
          pago.
        </p>

        {/* Dos caminos y ninguno preseleccionado. El primero no pide nada; el
            segundo dice de frente que lleva a entrar con Google, para que
            nadie lo toque creyendo que sigue mirando. */}
        <Link
          href="/inicio"
          className="shadow-cartel-azul mt-7 block rounded-2xl bg-card p-5 transition-transform hover:-translate-y-0.5"
        >
          <span className="font-heading block text-xl">Necesito un servicio</span>
          <span className="mt-1.5 block text-base text-muted-foreground">
            Busca en tu zona, mira quién está disponible y escríbele.
          </span>
        </Link>

        <Link
          href="/login"
          className="shadow-cartel-amarillo mt-4 block rounded-2xl bg-card p-5 transition-transform hover:-translate-y-0.5"
        >
          <span className="font-heading block text-xl">Ofrezco mi trabajo</span>
          <span className="mt-1.5 block text-base text-muted-foreground">
            Entra con Google, publica tu oficio y aparece cuando alguien busque
            cerca.
          </span>
        </Link>

        {/* La salida honesta, y no en letra pequeña. El subrayado es lima
            porque aquí es un trazo, no letra: la palabra va en tinta. */}
        <p className="mt-8 text-center text-base text-muted-foreground">
          Buscar y pedir no necesita cuenta.
          <br />
          <Link
            href="/login"
            className="decoration-primary text-foreground mt-1 inline-block font-semibold underline decoration-2 underline-offset-4"
          >
            Entrar con Google
          </Link>
        </p>

        <p className="mt-6 text-center text-base">
          <Link href="/ayudas" className="text-enlace underline underline-offset-4">
            ¿Necesitas ayuda de emergencia?
          </Link>
        </p>
      </main>
    </div>
  )
}
