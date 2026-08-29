import Image from 'next/image'
import Link from 'next/link'

import isotipo from '@/../docs/marca/isotipo-carrito.png'
import { FranjaSombrilla } from '@/components/franja-sombrilla'

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
export function Bienvenida({ conSesion = false }: { conSesion?: boolean }) {
  return (
    // ⚠ `data-sin-cromo` SOLO sin sesión. Esa marca esconde encabezado,
    // barra inferior y pie desde `globals.css`, y desde el ADR 0010 esta es
    // la pantalla a la que lleva el logo: dejarla sin cromo con sesión sería
    // llevar a alguien a un sitio sin salida.
    <div data-sin-cromo={conSesion ? undefined : true} className="min-h-dvh">
      <FranjaSombrilla />

      <main className="animar-pantalla mx-auto flex max-w-md flex-col px-5 py-8">
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
          className="pulsable-tarjeta shadow-cartel-azul mt-7 block rounded-2xl bg-card p-5 transition-transform hover:-translate-y-0.5"
        >
          <span className="font-heading block text-xl">Necesito un servicio</span>
          <span className="mt-1.5 block text-base text-muted-foreground">
            Busca en tu zona, mira quién está disponible y escríbele.
          </span>
        </Link>

        {/* ⚠ El `?volver=` no es cosmético. Sin él, entrar por aquí llevaba a
            Google y de vuelta al alta de cuenta, y ahí se acababa el
            recorrido: quien venía a publicar su oficio tenía que volver a
            buscar esta pantalla. Con él, `PuertaCerrada` y esto hacen lo
            mismo, que es lo que se espera de dos botones con el mismo texto.
            La ruta está en la lista blanca de `lib/destino.ts`. */}
        <Link
          href={
            conSesion
              ? '/servicios/soy-proveedor'
              : '/login?volver=%2Fservicios%2Fsoy-proveedor'
          }
          className="pulsable-tarjeta shadow-cartel-amarillo mt-4 block rounded-2xl bg-card p-5 transition-transform hover:-translate-y-0.5"
        >
          <span className="font-heading block text-xl">Ofrezco mi trabajo</span>
          <span className="mt-1.5 block text-base text-muted-foreground">
            {conSesion
              ? 'Publica tu oficio, tus precios y tu zona, y aparece cuando alguien busque cerca.'
              : 'Entra con Google, publica tu oficio y aparece cuando alguien busque cerca.'}
          </span>
        </Link>

        {/* La salida honesta, y no en letra pequeña. El subrayado es lima
            porque aquí es un trazo, no letra: la palabra va en tinta.

            ⚠ Decía «Buscar y pedir no necesita cuenta», y pedir sí la
            necesita desde el ADR 0006. Prometer en la portada algo que la
            pantalla siguiente desmiente es peor que no prometer nada. */}
        {!conSesion && (
          <p className="mt-8 text-center text-base text-muted-foreground">
            Mirar quién hay cerca no necesita cuenta.
            <br />
            <Link
              href="/login"
              className="decoration-primary text-foreground mt-1 inline-block font-semibold underline decoration-2 underline-offset-4"
            >
              Entrar con Google
            </Link>
          </p>
        )}

      </main>
    </div>
  )
}
