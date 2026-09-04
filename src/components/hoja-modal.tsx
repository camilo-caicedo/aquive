'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ContenedorHoja } from '@/components/contenedor-hoja'

/**
 * Si el contenido de la hoja tiene algo sin guardar, tocar el fondo no
 * cierra.
 *
 * Sin esto, el selector de archivos nativo del teléfono puede devolver el
 * foco con un clic sintético cuyo `target` es el propio `<dialog>` —lo
 * mismo que un clic real en el fondo—, y eso desmonta en silencio un
 * formulario a medias (CLAUDE.md, mecanismo 2). El caso que lo disparó era
 * de subir una foto, así que solo lo declaran las hojas con un formulario
 * largo y una subida de imagen; el resto no lo necesita y una hoja fuera de
 * `HojaModal` no tiene fondo del que protegerse.
 */
const CambiosSinGuardar = createContext<{ current: boolean } | null>(null)

/** `useCambiosSinGuardar(titulo.trim() !== '')`, con lo que haga que valga
 *  la pena no perder el formulario. */
export function useCambiosSinGuardar(hay: boolean) {
  const ref = useContext(CambiosSinGuardar)
  useEffect(() => {
    if (ref) ref.current = hay
  }, [ref, hay])
}

/**
 * El caparazón de una pantalla interceptada.
 *
 * Sirve para que tocar una tarjeta abra la ficha encima de la lista en vez
 * de reemplazarla: la lista se queda montada detrás, con su scroll y sus
 * filtros, y cerrar devuelve exactamente al sitio donde se estaba.
 *
 * ⚠ La URL cambia igual. Esto va dentro de una ruta interceptora
 * (`app/@modal/(.)…`), así que `/servicios/<id>` sigue siendo una
 * dirección real: pegada en WhatsApp o abierta desde cero sirve la
 * pantalla entera, sin modal. La intercepción solo ocurre cuando ya se
 * estaba dentro de la aplicación, que es justo cuando reemplazar la
 * pantalla estorba.
 *
 * Es el `<dialog>` del navegador y no un `div` con `position: fixed`: la
 * captura del foco, `Escape`, el fondo y quedar por encima de todo —capa
 * superior, sin pelear con ningún `z-index`— los da el navegador. Escritos
 * a mano, la parte que siempre falta es la del foco, y es la que decide si
 * esto se puede usar con lector de pantalla.
 *
 * ⚠ Y por eso mismo los desplegables de dentro se portalizan AQUÍ y no al
 * `body`. Estar en la capa superior es lo que hace que el diálogo se pinte
 * encima de todo sin z-index, y también lo que deja debajo a cualquier cosa
 * que se monte fuera de él: una lista de municipios portalizada al `body`
 * se abría de verdad —`aria-expanded="true"`— y quedaba tapada por el
 * propio diálogo. Es el mismo motivo, la misma causa y el mismo remedio que
 * en `HojaAccion` y `HojaFiltros`; lo explica `contenedor-hoja.ts`.
 *
 * Los tres formularios que se abren así —publicar en el muro, pedir ayuda y
 * pedir un servicio— tienen todos un municipio que elegir, así que esto no
 * era un caso raro: era el caso normal.
 */
export function HojaModal({
  etiqueta,
  ruta,
  children,
}: {
  /** Qué es, para quien no ve la pantalla. */
  etiqueta: string
  /**
   * La ruta de esta hoja, sin query. Es lo que le permite saber cuándo ya
   * no le toca.
   *
   * ⚠ Sin esto la hoja sobrevive a las navegaciones de debajo. Next
   * conserva el estado de los slots que no casan con la URL nueva —para
   * eso están—, así que tocar «Entrar con Google» cargaba `/login` detrás
   * y la hoja se quedaba encima, tapándolo. Y cerrarla devolvía al
   * directorio, porque la historia sí había avanzado.
   */
  ruta: string
  children: ReactNode
}) {
  const router = useRouter()
  const rutaActual = usePathname()
  // Estado y no `useRef`: el contenedor de los desplegables tiene que
  // provocar un render cuando el nodo existe, o el primero que se abra lo
  // recibe en nulo y vuelve a portalizarse al `body`.
  const [dialogo, setDialogo] = useState<HTMLDialogElement | null>(null)
  // Lo que declaró el contenido con `useCambiosSinGuardar`. En un `ref` y
  // no en estado: cambia con cada tecla del formulario de adentro, y aquí
  // solo hace falta LEERLO en el momento del clic, no volver a pintar la
  // hoja cada vez que cambia.
  const cambiosSinGuardar = useRef(false)

  // Le toca cuando la URL es la suya. Deja de tocarle en cuanto lo de
  // debajo navega a otra parte, y vuelve a tocarle si se regresa con la
  // flecha atrás.
  const leToca = rutaActual === ruta

  useEffect(() => {
    if (!leToca) return

    const abrir = () => {
      if (dialogo && !dialogo.open) dialogo.showModal()
    }
    abrir()

    // ⚠ `pageshow` no es paranoia. Desde la hoja se puede salir del sitio
    // —una pasarela de acceso se lleva el navegador entero— y al volver con
    // la flecha atrás la página se restaura de la caché sin re-montar nada.
    // El navegador NO conserva la capa superior en esa caché, así que el
    // diálogo vuelve cerrado: la hoja desaparece, la URL sigue diciendo que
    // está abierta y no queda nada que tocar.
    window.addEventListener('pageshow', abrir)
    return () => window.removeEventListener('pageshow', abrir)
    // ⚠ Depende de `leToca` y no de nada más. El componente NO se desmonta
    // al navegar por debajo —Next conserva el slot—, así que un efecto que
    // solo corriera al montar dejaría el diálogo cerrado para siempre en
    // cuanto se volviera aquí con la flecha atrás.
  }, [leToca, dialogo])

  // ⚠ Safari de iOS no recorta la CAPA SUPERIOR contra la parte visible de
  // la ventana, y sí recorta lo que es `position: fixed`. Se ve en la misma
  // pantalla: la barra inferior de la aplicación queda encima de la barra
  // del navegador, y la hoja —que está en la capa superior— se ancla al
  // fondo de la pantalla entera y se mete detrás de ella. Lo que se va es
  // el final de la hoja, que es justo donde vive el botón de la acción.
  //
  // No hay unidad de CSS que sirva: `100lvh - 100dvh` mide esa barra, pero
  // vale lo mismo en Android, donde el navegador SÍ recorta y subir la hoja
  // la dejaría flotando. Así que se mide la hoja de verdad y se sube lo que
  // sobre, que en un navegador que ya recorta da cero y no hace nada.
  useEffect(() => {
    const ventana = window.visualViewport
    if (!leToca || !dialogo || !ventana) return

    const raiz = document.documentElement
    // ⚠ Solo se mide con la hoja quieta. Sube con un `translateY` de 2 rem
    // y `getBoundingClientRect()` lo incluye: medir en el primer fotograma
    // daba 32 px de barra inventados, y la hoja se quedaba flotando a esa
    // altura para siempre. `vivo` es para la promesa, que puede resolverse
    // cuando la hoja ya se cerró.
    let quieta = false
    let vivo = true

    const ajustar = () => {
      if (!quieta || !vivo) return
      raiz.style.setProperty('--barra-navegador', '0px')
      const fondoVisible = ventana.offsetTop + ventana.height
      const tapado = Math.round(dialogo.getBoundingClientRect().bottom - fondoVisible)
      // El tope es lo que mide una barra de navegador. Sin él, el teclado
      // —que encoge esta misma medida en varios cientos de píxeles— subiría
      // la hoja hasta sacarle la cabecera por arriba.
      if (tapado > 1) raiz.style.setProperty('--barra-navegador', `${Math.min(tapado, 160)}px`)
    }

    const asentar = () => {
      quieta = true
      ajustar()
    }
    Promise.all(dialogo.getAnimations().map((a) => a.finished)).then(asentar, asentar)

    ventana.addEventListener('resize', ajustar)
    ventana.addEventListener('scroll', ajustar)
    return () => {
      ventana.removeEventListener('resize', ajustar)
      ventana.removeEventListener('scroll', ajustar)
      vivo = false
      raiz.style.removeProperty('--barra-navegador')
    }
  }, [leToca, dialogo])

  // Cerrar es volver: la entrada anterior de la historia es la lista, así
  // que la URL y lo que se ve vuelven juntos.
  //
  // ⚠ Va en `cancel` y en el clic del fondo, y NO en `close`. `close` lo
  // dispara también el navegador —al restaurar de la caché, al descargar la
  // página—, y ahí un `router.back()` es una navegación que nadie pidió.
  // Estos dos solo ocurren cuando alguien los provoca.
  const cerrar = () => router.back()

  // Se quita entera, y con ella el bloqueo del scroll y la capa superior.
  // Va DESPUÉS de los ganchos, que no se pueden saltar.
  if (!leToca) return null

  return (
    <dialog
      ref={setDialogo}
      aria-label={etiqueta}
      onCancel={(e) => {
        e.preventDefault()
        cerrar()
      }}
      onClick={(e) => {
        if (e.target === dialogo && !cambiosSinGuardar.current) cerrar()
      }}
      className="animar-hoja m-0 mt-auto mb-[var(--barra-navegador,0px)] max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-3xl bg-background p-0 text-foreground backdrop:bg-foreground/40 sm:mx-auto sm:my-auto sm:mb-auto sm:max-h-[88dvh] sm:rounded-3xl"
    >
      {/* El asa. No hace nada —cerrar es `Escape`, la flecha de volver o el
          fondo—, pero es lo que dice que esto se puede cerrar sin haberlo
          probado. */}
      <div className="flex shrink-0 justify-center pt-2 pb-1">
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-border" />
      </div>
      <CambiosSinGuardar.Provider value={cambiosSinGuardar}>
        <ContenedorHoja.Provider value={dialogo}>{children}</ContenedorHoja.Provider>
      </CambiosSinGuardar.Provider>
    </dialog>
  )
}
