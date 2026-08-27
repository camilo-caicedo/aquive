'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

/**
 * El evento que Chrome dispara cuando la aplicación se puede instalar.
 * No está en los tipos del DOM porque no es estándar todavía.
 */
interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Instalar AquíVe en el teléfono.
 *
 * Usa el instalador del propio navegador —el «Instalar aplicación» de
 * Chrome, que ya funciona porque el sitio tiene manifiesto y service
 * worker—: no hay tienda de aplicaciones ni descarga de un archivo, y
 * prometer eso sería mentir.
 *
 * ⚠ Solo se dibuja cuando el navegador dice que se puede. Chrome avisa con
 * `beforeinstallprompt`; hasta que ese evento no llega, el botón no existe
 * — un botón de instalar que al tocarlo no hace nada es peor que ninguno.
 *
 * Eso deja fuera a Safari en iPhone, que no dispara el evento y exige
 * «Añadir a pantalla de inicio» desde el menú de compartir. Ahí no se
 * enseña nada: la explicación de ese camino ya vive donde hace falta —en
 * los avisos, que es lo único que en iOS depende de tener la aplicación
 * en la pantalla de inicio—.
 *
 * Tampoco aparece si ya está instalada: en modo `standalone` el navegador
 * no vuelve a disparar el evento, así que se cae solo.
 */
export function BotonInstalar() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null)

  useEffect(() => {
    function alPoder(e: Event) {
      // Sin esto Chrome pinta su propia barra de instalación encima de la
      // página, que en un teléfono tapa el encabezado entero.
      e.preventDefault()
      setEvento(e as EventoInstalar)
    }

    // Cuando termina de instalarse el botón sobra.
    function alInstalar() {
      setEvento(null)
    }

    window.addEventListener('beforeinstallprompt', alPoder)
    window.addEventListener('appinstalled', alInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', alPoder)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [])

  if (!evento) return null

  async function instalar() {
    if (!evento) return
    await evento.prompt()
    // El evento sirve una sola vez: aceptado o no, ya no se puede volver a
    // usar, y guardarlo dejaría un botón que la segunda vez no hace nada.
    setEvento(null)
  }

  return (
    <button
      type="button"
      onClick={instalar}
      aria-label="Instalar AquíVe en este teléfono"
      title="Instalar AquíVe"
      className="pulsable flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Download className="size-5" aria-hidden="true" />
    </button>
  )
}
