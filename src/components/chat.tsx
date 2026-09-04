'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'

import { rpc } from '@/orpc/cliente'
import { useHidratado } from '@/components/hidratado'
import { MarcoFlujo } from '@/components/marco-flujo'
import { TarjetaOrdenChat } from '@/components/tarjeta-orden-chat'
import type { Autor, Hilo, Mensaje, Origen } from '@/contrato/chat'

/**
 * Qué le pasa a esta conversación, dicho para cada origen.
 *
 * ⚠ Aquí decía, para los cuatro a la vez: «Esta conversación se borra con
 * lo que la abrió. No queda archivada.» Es verdad y es exactamente cómo
 * está escrita la regla de producto 3 — y por eso mismo no sirve en
 * pantalla. «Lo que la abrió» es una llave foránea; quien lee esto está
 * mirando un chat con una modista y no tiene por qué saber de qué cuelga.
 * Y «no queda archivada» describe lo que el sistema NO hace, cuando lo que
 * la persona necesita saber es qué hacer: apuntar la dirección por fuera si
 * la va a necesitar el jueves.
 *
 * Regla de interfaz: sin jerga técnica en ningún texto visible; y el
 * responsable pidió el 3 de septiembre de 2026 que nada diga algo distinto
 * de lo que va a pasar de verdad.
 */
const AVISO_BORRADO: Record<Origen['tipo'], string> = {
  solicitud:
    'Esta conversación se borra junto con el pedido. Apunta por fuera lo que necesites guardar.',
  producto:
    'Esta conversación se borra si quien lo vende quita el producto. Apunta por fuera lo que necesites guardar.',
  muro: 'Esta conversación se borra si quien la publicó quita la donación. Apunta por fuera lo que necesites guardar.',
  ficha:
    'Esta conversación se borra si esta persona borra su ficha. Apunta por fuera lo que necesites guardar.',
}

/**
 * El hilo. Pantalla 12, y el mismo para los cuatro orígenes.
 *
 * Sirve a los dos lados con el mismo componente. Quién es cada quien lo
 * resuelve el servidor —de quién es la solicitud, el producto, la ficha o
 * la publicación— y lo dice en `hilo.soy`, así que aquí solo cambia de qué
 * lado va cada burbuja.
 *
 * ⚠ Monta él mismo su `MarcoFlujo` y mete el campo de escribir en `accion`,
 * que es la barra fija de abajo. Antes el campo iba en el cuerpo, y como el
 * cuerpo solo mide lo que miden los mensajes, en un hilo corto quedaba
 * flotando a media pantalla con medio dedo de crema debajo. Un chat se
 * escribe desde abajo siempre, tenga cuatro mensajes o cuarenta.
 *
 * Sin sondeo automático a propósito. Un `setInterval` contra el servidor
 * cada pocos segundos, en un teléfono viejo con datos contados, gasta
 * batería y plan para casi siempre no traer nada. Se refresca al enviar; el
 * aviso de mensaje nuevo llega por push, que es para lo que está.
 */
export function Chat({
  origen,
  hiloInicial,
  volver,
}: {
  origen: Origen
  hiloInicial: Hilo
  volver: string
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(hiloInicial.mensajes)
  const [cuerpo, setCuerpo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [rechazo, setRechazo] = useState<string | null>(null)
  const finRef = useRef<HTMLDivElement>(null)

  // Las horas y los días solo después de hidratar. El servidor va en UTC y
  // el teléfono en la hora de aquí: pintarlas en la primera pasada es
  // pintar una hora equivocada y que React no la corrija (ADR 0005).
  const hidratado = useHidratado()

  // El hilo abre por el final, que es donde está la conversación.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' })
  }, [mensajes.length])

  // Cuántos había al abrir. Lo que pase de ahí lo escribió esta persona en
  // esta sesión, y es lo único que entra moviéndose.
  //
  // Estado inicial y no un ref: el valor se captura una vez al montar y no
  // cambia nunca, y leer un ref durante el render es justo lo que el
  // compilador de React no admite.
  const [alAbrir] = useState(mensajes.length)

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    const texto = cuerpo.trim()
    if (!texto || enviando) return

    setEnviando(true)
    setRechazo(null)
    try {
      const { mensaje } = await rpc.chat.escribir({ origen, cuerpo: texto })
      setMensajes((previos) => [...previos, mensaje])
      setCuerpo('')
    } catch (error) {
      // El motivo viene tipado del contrato: se dice EXACTAMENTE por qué no
      // se envió. Un filtro que rechaza sin explicar enseña a pelear con la
      // pantalla, no a coordinar por aquí.
      const motivo =
        error && typeof error === 'object' && 'data' in error
          ? ((error.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setRechazo(motivo ?? 'No se pudo enviar. Revisa la conexión.')
    } finally {
      setEnviando(false)
    }
  }

  const cerrado = hiloInicial.cerrado
  const filas = agrupar(mensajes, hiloInicial.soy, alAbrir)

  return (
    <MarcoFlujo
      titulo={hiloInicial.con}
      subtitulo={hiloInicial.asunto ?? undefined}
      volver={volver}
      accion={
        cerrado ? (
          <p className="text-base text-muted-foreground">
            Este hilo ya se cerró. No se pueden enviar más mensajes.
          </p>
        ) : (
          <form onSubmit={enviar}>
            {rechazo && (
              <p
                role="alert"
                className="bg-accent text-accent-foreground mb-2 rounded-xl px-4 py-3 text-base"
              >
                {rechazo}
              </p>
            )}
            <div className="flex items-end gap-2">
              <label htmlFor="cuerpo" className="sr-only">
                Escribe un mensaje
              </label>
              <textarea
                id="cuerpo"
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                maxLength={500}
                rows={1}
                placeholder="Escribe un mensaje"
                // `field-sizing-content` crece con lo escrito sin una línea
                // de JavaScript. Donde no exista, se queda en `min-h-14` y
                // el campo desplaza por dentro: igual de usable.
                className="bg-card border-input focus-visible:ring-ring shadow-canto max-h-32 min-h-14 flex-1 resize-none rounded-2xl border px-4 py-4 text-base field-sizing-content focus-visible:ring-2 focus-visible:outline-none"
              />
              <button
                type="submit"
                disabled={enviando || cuerpo.trim().length === 0}
                className="bg-primary text-primary-foreground shadow-boton active:shadow-boton-hundido flex size-14 shrink-0 items-center justify-center rounded-full transition-all active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40"
                aria-label={enviando ? 'Enviando el mensaje' : 'Enviar mensaje'}
              >
                <Send
                  className={`size-6 ${enviando ? 'punto-urgente' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </div>
            {/* La línea corta va aquí, pegada al campo, porque es donde se
                está a punto de escribir un número. Lo demás —que el hilo se
                borra con lo que lo abrió— se dice una vez arriba. */}
            <p className="mt-2 text-sm text-muted-foreground">
              No se pueden compartir teléfonos ni correos por aquí.
            </p>
          </form>
        )
      }
    >
      {origen.tipo === 'solicitud' && hiloInicial.orden && (
        <TarjetaOrdenChat
          solicitudId={origen.id}
          soy={hiloInicial.soy}
          orden={hiloInicial.orden}
        />
      )}

      <p className="text-center text-sm text-muted-foreground">
        {AVISO_BORRADO[origen.tipo]}
      </p>

      {mensajes.length === 0 ? (
        <p className="mt-8 text-center text-base text-muted-foreground">
          Todavía no hay mensajes.
          <br />
          Escribe para ponerse de acuerdo.
        </p>
      ) : (
        <ol className="mt-4 space-y-1" aria-live="polite">
          {filas.map((fila) =>
            fila.clase === 'dia' ? (
              <li key={fila.clave} className="flex justify-center py-3">
                {/* Antes de hidratar no se pinta: el día de un mensaje de
                    medianoche cambia según la zona horaria. */}
                <span className="bg-secondary text-muted-foreground rounded-full px-3 py-1 text-sm">
                  {hidratado ? diaLegible(fila.iso) : '·'}
                </span>
              </li>
            ) : (
              <li
                key={fila.clave}
                className={`flex ${fila.mio ? 'justify-end' : 'justify-start'} ${
                  fila.empiezaTanda ? 'pt-2' : ''
                } ${fila.recienEnviado ? 'animar-entrada' : ''}`}
              >
                {/* Lo mío en blanco y lo suyo en amarillo, por decisión del
                    responsable. Antes lo propio iba en arena, que sobre el
                    crema son dos tonos que se distinguen en una muestra de
                    color y no en un teléfono al sol.

                    El amarillo es uno de los cuatro gajos de la sombrilla, y
                    aquí va como RELLENO con tinta encima, que es la única
                    forma en que la paleta admite un color. No es lima: el
                    lima es la acción de enviar, una por pantalla, y veinte
                    burbujas lima serían lima dominante.

                    Que no lleve la palabra al lado no rompe la regla de las
                    familias. Aquí el color no dice «confección»: dice «esto
                    lo escribió el otro», y eso lo dicen además el lado y la
                    esquina de la cola. */}
                <div
                  className={`shadow-canto max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    fila.mio
                      ? `bg-card ${fila.cierraTanda ? 'rounded-br-sm' : ''}`
                      : `bg-familia-amarillo text-foreground ${fila.cierraTanda ? 'rounded-bl-sm' : ''}`
                  }`}
                >
                  <p className="text-base whitespace-pre-line">{fila.cuerpo}</p>
                  {/* Solo en el último de una tanda: cinco mensajes seguidos
                      del mismo minuto con cinco horas iguales debajo es ruido
                      que hay que saltarse para leer la conversación.

                      Sobre el amarillo no sirve `muted-foreground`: ese pardo
                      sobre ese amarillo no llega a AA. Va tinta rebajada, que
                      da la misma jerarquía sin perder el contraste. */}
                  {fila.cierraTanda && (
                    <p
                      className={`mt-0.5 text-sm ${
                        fila.mio ? 'text-right text-muted-foreground' : 'text-foreground/75'
                      }`}
                    >
                      {hidratado ? horaLegible(fila.iso) : ' '}
                    </p>
                  )}
                </div>
              </li>
            ),
          )}
        </ol>
      )}
      {/* Fuera del `ol`: un `div` suelto entre `li` es marcado inválido, y
          además se comía un renglón del `space-y`. */}
      <div ref={finRef} />
    </MarcoFlujo>
  )
}

type Fila =
  | { clase: 'dia'; clave: string; iso: string }
  | {
      clase: 'mensaje'
      clave: string
      iso: string
      cuerpo: string
      mio: boolean
      /** Primero de una tanda del mismo autor: se separa del bloque anterior. */
      empiezaTanda: boolean
      /** Último de la tanda: lleva la hora y la esquina de la cola. */
      cierraTanda: boolean
      /**
       * Se envió en esta sesión, después de abrir el hilo. Es lo único
       * que entra moviéndose.
       *
       * ⚠ No se anima la lista entera: al abrir un hilo de treinta
       * mensajes, treinta burbujas entrando a la vez es una cortina, no
       * una conversación. Y aquí no hay sondeo —es deliberado, está
       * escrito arriba—, así que el único que «llega» es el propio.
       */
      recienEnviado: boolean
    }

/**
 * Mensajes a filas, con sus separadores de día y sus tandas.
 *
 * Una «tanda» son mensajes seguidos de la misma persona. Se dibujan pegados
 * y solo el último lleva hora y esquina, que es como se lee una
 * conversación: por quién habla, no por cuántas veces pulsó enviar.
 *
 * Se agrupa por la fecha en UTC a propósito, que es la que el servidor y el
 * navegador ven igual. El texto del separador sí sale en hora local, pero
 * solo después de hidratar.
 */
function agrupar(mensajes: Mensaje[], soy: Autor, habiaAlAbrir: number): Fila[] {
  const filas: Fila[] = []
  let diaAnterior: string | null = null

  for (let i = 0; i < mensajes.length; i++) {
    const m = mensajes[i]
    const dia = m.creado_at.slice(0, 10)
    if (dia !== diaAnterior) {
      filas.push({ clase: 'dia', clave: `dia-${dia}-${m.id}`, iso: m.creado_at })
      diaAnterior = dia
    }

    const anterior = mensajes[i - 1]
    const siguiente = mensajes[i + 1]

    filas.push({
      clase: 'mensaje',
      clave: m.id,
      iso: m.creado_at,
      cuerpo: m.cuerpo,
      mio: m.autor === soy,
      empiezaTanda: !anterior || anterior.autor !== m.autor,
      cierraTanda:
        !siguiente ||
        siguiente.autor !== m.autor ||
        siguiente.creado_at.slice(0, 10) !== dia,
      recienEnviado: i >= habiaAlAbrir,
    })
  }

  return filas
}

/** «Hoy», «Ayer», o el día escrito. Solo se llama ya hidratado. */
function diaLegible(iso: string) {
  const d = new Date(iso)
  const hoy = new Date()
  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (mismoDia(d, hoy)) return 'Hoy'
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  if (mismoDia(d, ayer)) return 'Ayer'
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
}

/**
 * «9:27 p.m.», no «09:27 p. m.».
 *
 * `es-CO` escribe el sufijo con espacios dentro —«p. m.»— y con cero
 * delante. En una burbuja de chat eso son cuatro caracteres de ruido
 * repetidos veinte veces; el punto de la hora es poder saltársela.
 */
function horaLegible(iso: string) {
  return new Date(iso)
    .toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
    .replace(/ /g, ' ')
    .replace('a. m.', 'a.m.')
    .replace('p. m.', 'p.m.')
}
