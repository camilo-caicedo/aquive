'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell,
  BellOff,
  BellRing,
  MessageSquare,
  UserPlus,
  Clock,
  HeartHandshake,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
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
const ICONO_AVISO: Record<Aviso['tipo'], LucideIcon> = {
  mensaje: MessageSquare,
  invitacion: UserPlus,
  sin_atender: Clock,
  acompanamiento: HeartHandshake,
  reporte: ShieldAlert,
}

/** El día de un aviso, para agrupar. «Hoy» y «Ayer» por nombre. */
function diaDe(fecha: string) {
  const d = new Date(fecha)
  const hoy = new Date()
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  const igual = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (igual(d, hoy)) return 'Hoy'
  if (igual(d, ayer)) return 'Ayer'
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
}

export function BotonAvisos({ sinVer }: { sinVer: number }) {
  const panel = useRef<HTMLDivElement>(null)
  const campana = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const [avisos, setAvisos] = useState<Aviso[] | null>(null)
  // ⚠ Esto era `const [nuevos] = useState(sinVer)`, y ahí estaba el error:
  // `useState` lee su valor inicial UNA vez, al montar. El encabezado vive
  // en el layout, que no se vuelve a pintar al navegar con `Link`, así que
  // el número se quedaba congelado en el de la primera carga de la página
  // —normalmente cero— y no volvía a subir nunca. La campana solo enseñaba
  // algo cuando alguien la abría, que es justo cuando ya no hace falta
  // avisar.
  //
  // Ahora el numero del servidor es solo el valor de arranque y el sondeo
  // de abajo lo mantiene al dia, siempre con el panel CERRADO: al abrir se
  // marcan como vistos y el servidor pasa a decir 0, y los que estaban sin
  // ver tienen que seguir resaltados mientras se leen.
  const [nuevos, setNuevos] = useState(sinVer)

  const estaAbierto = () => !!panel.current?.matches(':popover-open')


  // Y se pregunta cada tanto, porque un aviso llega mientras la pestaña ya
  // está abierta: sin esto habría que recargar a mano para enterarse. Solo
  // con la pestaña a la vista, para no consultar en segundo plano en el
  // teléfono de alguien.
  useEffect(() => {
    let vivo = true

    async function mirar() {
      if (document.visibilityState !== 'visible' || estaAbierto()) return
      const { data } = await createClient().rpc('estado_encabezado')
      if (!vivo || estaAbierto()) return
      setNuevos((data as { avisos_sin_ver?: number } | null)?.avisos_sin_ver ?? 0)
    }

    const reloj = setInterval(mirar, 60000)
    document.addEventListener('visibilitychange', mirar)
    mirar()
    return () => {
      vivo = false
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', mirar)
    }
  }, [])
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
      // ⚠ El anclaje SOLO en pantalla mediana y grande, que es donde
      // esto es un panel colgado de la campana. En el teléfono es una hoja
      // inferior, y su sitio lo pone el CSS: si aquí se escribiera
      // `style.top`, ese valor en línea le ganaría al `bottom-0 top-auto`
      // de las clases y la hoja aparecía pegada arriba, debajo del
      // encabezado. Por eso además se limpian los dos: el mismo panel
      // cambia de forma al girar el teléfono.
      const anclado = document.documentElement.clientWidth >= 640
      const boton = campana.current?.getBoundingClientRect()
      if (elemento && anclado && boton) {
        elemento.style.top = `${boton.bottom + 8}px`
        // `clientWidth` y no `window.innerWidth`: el segundo cuenta la
        // barra de desplazamiento y el panel quedaba corrido esos píxeles.
        elemento.style.right = `${document.documentElement.clientWidth - boton.right}px`
      } else if (elemento) {
        elemento.style.top = ''
        elemento.style.right = ''
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
        aria-label={nuevos > 0 ? `Avisos, ${nuevos} sin ver` : 'Avisos'}
        className="relative flex size-12 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
      >
        <Bell className="size-5" aria-hidden="true" />
        {nuevos > 0 && (
          // Un punto, no el número. Antes iba el conteo, con el argumento
          // de que «hay algo» y «hay siete cosas» no piden la misma prisa;
          // es verdad, pero un «9+» sobre un icono de 20 px no se lee en un
          // teléfono al sol, que es donde se usa esto. El número exacto
          // sigue estando dentro, en la hoja, junto a cada aviso.
          // ⚠ El anillo es TINTA, no papel. El lima sobre el crema del
          // encabezado da 1,35:1: un punto de 10 px con anillo del mismo
          // fondo no se veía. Con el canto negro del cartel se lee, y sigue
          // sin depender solo del color — la campana ya dice «N sin ver».
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 size-2.5 rounded-full bg-primary ring-2 ring-foreground"
          />
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
        className="hoja-inferior fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88vh] w-full max-w-none overflow-y-auto rounded-t-2xl border-t border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-foreground/40 sm:inset-auto sm:max-h-[70vh] sm:w-96 sm:rounded-xl sm:border"
      >
        <div className="sticky top-0 z-10 border-b border-border bg-background px-4 pt-2">
          <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-border sm:hidden" />
          <div className="flex items-center justify-between gap-3 py-2">
            <p className="font-heading text-2xl">Avisos</p>
            <button
              type="button"
              popoverTarget="panel-avisos"
              popoverTargetAction="hide"
              aria-label="Cerrar"
              className="-mr-2 flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                ×
              </span>
            </button>
          </div>
        </div>

        {/* Si están apagados, esto es lo primero y lleva la razón, no solo
            el interruptor: sin avisos hay que entrar a mirar a mano, y nadie
            vuelve. El permiso exige un gesto y un «Bloquear» es permanente,
            así que se explica antes de pedirlo — el mismo criterio que ya
            usa `activar-avisos.tsx`. */}
        {!activo && (
          <div className="border-b border-border bg-accent px-4 py-3 text-accent-foreground">
            <p className="text-base font-medium">Activa los avisos</p>
            <p className="mt-1 text-sm">
              Sin esto tienes que entrar a mirar si te respondieron. En iPhone
              solo funciona si agregas AquíVe a la pantalla de inicio: hazlo
              antes de tocar el botón, porque si dices que no, no se puede
              deshacer.
            </p>
            <button
              type="button"
              onClick={alternarPush}
              disabled={push === 'cargando' || push === 'trabajando'}
              className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-50"
            >
              <IconoPush className="size-5 shrink-0" aria-hidden="true" />
              Activar avisos
            </button>
            {mensaje && (
              <p role="status" className="mt-2 text-sm">
                {mensaje}
              </p>
            )}
          </div>
        )}

        {avisos === null ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : avisos.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nada nuevo por ahora. Aquí aparecen los mensajes y las entregas de
            las solicitudes donde participas.
          </p>
        ) : (
          <ul>
            {avisos.map((aviso, i) => {
              const Icono = ICONO_AVISO[aviso.tipo]
              const dia = diaDe(aviso.fecha)
              const nuevoDia = i === 0 || diaDe(avisos[i - 1].fecha) !== dia
              return (
                <li key={aviso.tipo + aviso.fecha + i}>
                  {nuevoDia && (
                    <p className="px-4 pt-4 pb-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                      {dia}
                    </p>
                  )}
                  <Link
                    href={aviso.href}
                    onClick={() => panel.current?.hidePopover()}
                    className={`mx-2 flex min-h-16 items-center gap-3 rounded-xl px-2 py-3 ${
                      i < nuevos ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                        i < nuevos ? 'bg-background text-enlace' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icono className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      {/* El texto lo escribe la RPC. Aquí solo se le pone
                          icono y se agrupa: reescribirlo dejaría dos
                          versiones del mismo aviso, y los tipos son los
                          cinco que devuelve `mis_avisos()` y ni uno más. */}
                      <span className={i < nuevos ? 'block text-base font-semibold' : 'block text-base'}>
                        {aviso.texto}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {haceCuanto(aviso.fecha)}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {activo && (
          <div className="p-3">
            <button
              type="button"
              onClick={alternarPush}
              aria-pressed
              className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-muted disabled:opacity-50"
            >
              <IconoPush className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1 text-base">Avisos activados en este dispositivo</span>
            </button>
            {mensaje && (
              <p role="status" className="px-2 pt-2 text-sm text-muted-foreground">
                {mensaje}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
