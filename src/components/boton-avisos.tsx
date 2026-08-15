'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { activarAvisos, avisosActivosAqui, desactivarAvisos } from '@/lib/avisos'
import type { Aviso } from '@/lib/types'

type EstadoPush = 'cargando' | 'activo' | 'inactivo' | 'trabajando'

// Cuánto tiempo hace, en palabras cortas. Una fecha absoluta no dice nada
// a quien mira una lista de avisos: lo que importa es si fue hace un rato
// o anteayer.
function haceCuanto(iso: string) {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  return dias === 1 ? 'ayer' : `hace ${dias} días`
}

/**
 * La campana del encabezado: qué pasó donde yo estoy metido.
 *
 * Se abre con el `popover` nativo y no con estado de React. Trae gratis el
 * cierre al tocar fuera, el `Escape` y el manejo del foco, y sobre todo no
 * se recorta: un desplegable `absolute` dentro del encabezado, que tiene
 * `overflow` y `backdrop-blur`, queda cortado por el borde.
 *
 * La lista se pide al abrir, no en cada carga de página. Del servidor solo
 * baja el número.
 *
 * Abajo, tras una línea, el interruptor de avisos de ESTE dispositivo: se
 * toca una vez cada varios meses y no merecía un botón permanente. El
 * estado es por navegador, así que apagarlo aquí no lo apaga en el otro
 * teléfono.
 */
export function BotonAvisos({ sinVer }: { sinVer: number }) {
  const panel = useRef<HTMLDivElement>(null)
  const campana = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const [avisos, setAvisos] = useState<Aviso[] | null>(null)
  // Congelado a propósito en el valor de la primera pintada: al abrir se
  // marcan como vistos y el servidor pasa a decir 0, pero los que estaban
  // sin ver tienen que seguir resaltados mientras el panel está abierto.
  const [nuevos] = useState(sinVer)
  const [push, setPush] = useState<EstadoPush>('cargando')
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    const elemento = panel.current
    if (!elemento) return

    async function alAbrir(e: Event) {
      if ((e as ToggleEvent).newState !== 'open') return

      // El popover vive en la capa superior del documento, así que no
      // hereda la posición de nada: si no se le dice dónde, el navegador
      // lo centra en la pantalla. Y no sirve pegarlo al borde derecho de
      // la ventana, porque el encabezado está centrado en `max-w-3xl` y
      // en pantalla ancha la campana queda muy adentro.
      //
      // Se calcula al abrir y no con `anchor-name` de CSS porque el
      // anclaje nativo todavía no existe en Safari, y aquí la mitad de
      // quien mira está en un iPhone.
      const boton = campana.current?.getBoundingClientRect()
      if (boton && elemento) {
        elemento.style.top = `${boton.bottom + 8}px`
        // `clientWidth` y no `window.innerWidth`: el segundo cuenta la
        // barra de desplazamiento y el panel quedaba corrido esos píxeles.
        elemento.style.right = `${document.documentElement.clientWidth - boton.right}px`
      }

      const supabase = createClient()
      const [lista] = await Promise.all([
        supabase.rpc('mis_avisos'),
        // Marcar visto al abrir, no al cerrar: si la persona toca un aviso
        // y se va, el panel no llega a cerrarse y el número se quedaría.
        supabase.rpc('marcar_avisos_vistos'),
      ])
      setAvisos((lista.data as Aviso[] | null) ?? [])
      setPush((await avisosActivosAqui()) ? 'activo' : 'inactivo')
      // Que el encabezado del servidor se entere de que ya está visto.
      router.refresh()
    }

    elemento.addEventListener('toggle', alAbrir)
    return () => elemento.removeEventListener('toggle', alAbrir)
  }, [router])

  async function alternarPush() {
    if (push === 'cargando' || push === 'trabajando') return
    const encendiendo = push === 'inactivo'
    setPush('trabajando')
    setMensaje(null)

    if (!encendiendo) {
      await desactivarAvisos()
      setPush('inactivo')
      return
    }

    const r = await activarAvisos()
    if (r === 'activado') {
      setPush('activo')
      return
    }
    setPush('inactivo')
    setMensaje(
      r === 'ios'
        ? 'En iPhone, agrega AquíVe a tu pantalla de inicio para recibir avisos.'
        : r === 'sin-permiso'
          ? 'Tu navegador bloqueó los avisos. Actívalos en los permisos del sitio.'
          : 'No pudimos activar los avisos.'
    )
  }

  const activo = push === 'activo'
  const IconoPush = push === 'trabajando' ? Bell : activo ? BellRing : BellOff

  return (
    <>
      <button
        ref={campana}
        type="button"
        popoverTarget="panel-avisos"
        aria-label={sinVer > 0 ? `Avisos, ${sinVer} sin ver` : 'Avisos'}
        className="relative flex size-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-5" aria-hidden="true" />
        {sinVer > 0 && (
          // Número y no solo punto: «hay algo» y «hay siete cosas» no piden
          // la misma prisa.
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground"
          >
            {sinVer > 9 ? '9+' : sinVer}
          </span>
        )}
      </button>

      {/* `popover` nativo: capa superior del documento, así que no lo
          recorta el encabezado. `top` y `right` los pone `alAbrir`, contra
          la campana; aquí solo va el ancho, que en pantalla angosta se
          queda con el de la ventana menos un margen.

          `inset-auto` no es adorno: el estilo del navegador para
          `[popover]` trae `inset: 0`, y ese `left: 0` le gana al `right`
          de arriba. Sin esto el panel se va a la esquina izquierda. */}
      <div
        ref={panel}
        id="panel-avisos"
        popover="auto"
        className="fixed inset-auto m-0 max-h-[70vh] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-border bg-popover p-0 text-foreground shadow-lg"
      >
        <p className="border-b border-border px-4 py-3 font-semibold">Avisos</p>

        {avisos === null ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : avisos.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nada nuevo por ahora. Aquí aparecen los mensajes y las entregas de
            las solicitudes donde participas.
          </p>
        ) : (
          <ul>
            {avisos.map((aviso, i) => (
              <li key={`${aviso.tipo}-${aviso.fecha}-${i}`}>
                <Link
                  href={aviso.href}
                  onClick={() => panel.current?.hidePopover()}
                  className="flex min-h-12 flex-col justify-center gap-0.5 border-b border-border px-4 py-3 hover:bg-muted"
                >
                  {/* Los `nuevos` primeros son los que no había visto: la
                      lista viene ordenada de más reciente a más viejo. */}
                  <span className={i < nuevos ? 'font-semibold' : undefined}>
                    {aviso.texto}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {haceCuanto(aviso.fecha)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="p-3">
          <button
            type="button"
            onClick={alternarPush}
            disabled={push === 'cargando' || push === 'trabajando'}
            aria-pressed={activo}
            className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-muted disabled:opacity-50"
          >
            <IconoPush className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1 text-sm">
              {activo
                ? 'Avisos activados en este dispositivo'
                : 'Activar avisos en este dispositivo'}
            </span>
          </button>
          {mensaje && (
            <p role="status" className="px-2 pt-2 text-sm text-muted-foreground">
              {mensaje}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
