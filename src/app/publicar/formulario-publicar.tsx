'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HeartHandshake } from 'lucide-react'
import type { Categoria, ItemCatalogoPublico, ItemSolicitudInput } from '@/lib/types'
import { LIMITE_MUNICIPIOS, nombreConDepartamento, type MunicipioBasico as Municipio } from '@/lib/municipios'
import { CATEGORIAS } from '@/lib/catalogo'
import { FECHA_LEGALES } from '@/lib/config'
import { validarBarrio, validarNota, validarSugerencia } from '@/lib/validacion'
import { createClient } from '@/lib/supabase/client'
import { AVISO_ALIADO_MUNICIPIO, type AliadoDelMunicipio } from '@/lib/acompanamiento'
import {
  CamposAcompanamiento,
  DATOS_VACIOS,
  datosCompletos,
  type DatosAcompanamiento,
} from '@/components/campos-acompanamiento'
import { TurnstileWidget } from '@/components/turnstile-widget'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from '@/components/ui/combobox'

type ItemCatalogo = ItemCatalogoPublico

const MAX_SUGERENCIAS = 3

interface RespuestaExito {
  codigo: string
  token: string
}

interface RespuestaError {
  error: string
}

function guardarEnLocalStorage(codigo: string, token: string) {
  try {
    const clave = 'mis_solicitudes'
    const actuales = JSON.parse(localStorage.getItem(clave) ?? '[]') as Array<{
      codigo: string
      token: string
      creada_at: string
    }>
    if (actuales.some((s) => s.token === token)) return
    actuales.unshift({ codigo, token, creada_at: new Date().toISOString() })
    localStorage.setItem(clave, JSON.stringify(actuales))
  } catch {
    // localStorage puede fallar (modo privado, cuota). No es crítico: el
    // enlace de todos modos se muestra en la pantalla de confirmación.
  }
}

/**
 * La cantidad mientras se está escribiendo, donde `0` significa «campo
 * vacío» y no «cero unidades».
 *
 * Antes el suelo era 1, y como un campo vacío llega aquí como `Number('')`,
 * o sea `0`, borrar el 1 lo devolvía en la misma tecla. Para pedir 20 había
 * que dejar el 1 y escribir alrededor. El suelo de 1 se aplica al salir del
 * campo, que es cuando ya se sabe qué quiso poner la persona.
 */
function mientrasSeEscribe(cantidad: number) {
  if (!Number.isFinite(cantidad)) return 0
  return Math.min(9999, Math.max(0, Math.trunc(cantidad)))
}

export function FormularioPublicar({
  municipios,
  items,
  turnstileSiteKey,
}: {
  municipios: Municipio[]
  items: ItemCatalogo[]
  turnstileSiteKey: string
}) {
  const router = useRouter()
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1)
  const [municipio, setMunicipio] = useState('')
  const [barrio, setBarrio] = useState('')
  const [categoria, setCategoria] = useState<Categoria | ''>('')
  const [seleccionados, setSeleccionados] = useState<ItemSolicitudInput[]>([])
  const [mostrarSugerencia, setMostrarSugerencia] = useState(false)
  const [textoSugerencia, setTextoSugerencia] = useState('')
  const [nota, setNota] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [puedeRecoger, setPuedeRecoger] = useState(false)
  const [aliados, setAliados] = useState<AliadoDelMunicipio[]>([])
  const [nombreMunicipio, setNombreMunicipio] = useState('')
  // El acompañamiento: se recoge aquí y se activa DESPUÉS de publicar,
  // porque `activar_acompanamiento` necesita el token y el token no existe
  // hasta que la solicitud está creada.
  const [datosAliado, setDatosAliado] = useState<DatosAcompanamiento>(DATOS_VACIOS)
  const [conAliado, setConAliado] = useState(false)

  // Se pregunta al elegir municipio y no en un efecto: es una consecuencia
  // de lo que la persona acaba de tocar, no una sincronización. Si la
  // consulta falla, no pasa nada — la tarjeta no aparece y publicar directo
  // sigue funcionando igual, que es el camino por defecto.
  async function elegirMunicipio(m: Municipio | null) {
    setMunicipio(m?.codigo_dane ?? '')
    setNombreMunicipio(m?.nombre ?? '')
    setAliados([])
    setDatosAliado(DATOS_VACIOS)
    if (!m) return

    const supabase = createClient()
    const { data } = await supabase.rpc('aliados_del_municipio', {
      p_municipio: m.codigo_dane,
    })
    const lista = (data as unknown as AliadoDelMunicipio[] | null) ?? []
    setAliados(lista)
    // Con una sola no hay nada que escoger. Con varias no se preselecciona
    // ninguna: elegir por la persona cuál fundación ve su documento no es
    // una comodidad, es una decisión que no nos toca.
    if (lista.length === 1) {
      setDatosAliado({ ...DATOS_VACIOS, organizacionId: lista[0].id })
    }
  }

  const errorBarrio = barrio ? validarBarrio(barrio) : null
  const errorNota = nota ? validarNota(nota) : null

  const itemsDeCategoria = useMemo(
    () => items.filter((i) => i.categoria === categoria),
    [items, categoria]
  )

  const numSugerencias = seleccionados.filter((s) => 'sugerencia' in s).length

  function alternarItem(itemId: string) {
    setSeleccionados((prev) =>
      prev.some((s) => 'item_id' in s && s.item_id === itemId)
        ? prev.filter((s) => !('item_id' in s && s.item_id === itemId))
        : [...prev, { item_id: itemId, cantidad: 1 }]
    )
  }

  function cambiarCantidad(itemId: string, cantidad: number) {
    setSeleccionados((prev) =>
      prev.map((s) =>
        'item_id' in s && s.item_id === itemId
          ? { ...s, cantidad: mientrasSeEscribe(cantidad) }
          : s
      )
    )
  }

  // Al salir del campo, un hueco vuelve a ser 1: nadie quiere pedir cero
  // de algo, y así no se llega al servidor con una cantidad inválida.
  function cerrarCantidad(itemId: string) {
    setSeleccionados((prev) =>
      prev.map((s) =>
        'item_id' in s && s.item_id === itemId && s.cantidad === 0
          ? { ...s, cantidad: 1 }
          : s
      )
    )
  }

  // Las sugerencias no tienen un id de catálogo para identificarlas: se
  // ubican por su posición en `seleccionados`, que no cambia de orden.
  function cambiarCantidadSugerencia(indice: number, cantidad: number) {
    setSeleccionados((prev) =>
      prev.map((s, i) => (i === indice ? { ...s, cantidad: mientrasSeEscribe(cantidad) } : s))
    )
  }

  function cerrarCantidadSugerencia(indice: number) {
    setSeleccionados((prev) =>
      prev.map((s, i) => (i === indice && s.cantidad === 0 ? { ...s, cantidad: 1 } : s))
    )
  }

  function quitarSugerencia(indice: number) {
    setSeleccionados((prev) => prev.filter((_, i) => i !== indice))
  }

  const errorSugerencia = textoSugerencia.trim() ? validarSugerencia(textoSugerencia) : null
  const puedeAgregarSugerencia =
    textoSugerencia.trim().length >= 2 &&
    !errorSugerencia &&
    numSugerencias < MAX_SUGERENCIAS &&
    seleccionados.length < 12

  function agregarSugerencia() {
    if (!puedeAgregarSugerencia) return
    setSeleccionados((prev) => [...prev, { sugerencia: textoSugerencia.trim(), cantidad: 1 }])
    setTextoSugerencia('')
    setMostrarSugerencia(false)
  }

  const puedeAvanzarPaso1 = municipio !== '' && barrio.trim().length >= 2 && !errorBarrio
  const puedeAvanzarPaso2 = categoria !== '' && seleccionados.length >= 1 && seleccionados.length <= 12
  const puedeEnviar =
    puedeAvanzarPaso1 && puedeAvanzarPaso2 && !errorNota && turnstileToken !== null && !enviando

  // El cuarto paso solo existe donde hay una fundación que ofrecer. Donde
  // no la hay, el formulario sigue teniendo tres, como siempre.
  const hayCuartoPaso = aliados.length > 0
  const pasos = hayCuartoPaso ? [1, 2, 3, 4] : [1, 2, 3]

  async function enviar() {
    if (!puedeEnviar) return
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          municipio,
          barrio: barrio.trim(),
          categoria,
          nota: nota.trim() || null,
          // Último filtro por si algún campo de cantidad llegó vacío hasta
          // aquí: `0` es «no escribí nada todavía», nunca una cantidad.
          items: seleccionados.map((s) => (s.cantidad === 0 ? { ...s, cantidad: 1 } : s)),
          puedeRecoger,
          turnstileToken,
        }),
      })
      const data = (await res.json()) as RespuestaExito | RespuestaError
      if (!res.ok || 'error' in data) {
        setError('error' in data ? data.error : 'No se pudo publicar la solicitud')
        setEnviando(false)
        return
      }
      guardarEnLocalStorage(data.codigo, data.token)

      // El acompañamiento va DESPUÉS de publicar y con el token en la mano,
      // en dos pasos y no en uno: si esto falla, la solicitud ya quedó
      // publicada —anónima, que es el modo seguro de fallar— y desde su
      // pantalla se puede volver a intentar. Al revés, un solo llamado que
      // fallara dejaría a la persona sin solicitud y con los datos escritos.
      if (conAliado && datosCompletos(datosAliado)) {
        const supabase = createClient()
        await supabase.rpc('activar_acompanamiento', {
          p_token: data.token,
          p_organizacion_id: datosAliado.organizacionId,
          p_nombre: datosAliado.nombre.trim(),
          p_documento_tipo: datosAliado.documentoTipo,
          p_documento: datosAliado.documento.trim(),
          p_autorizacion_version: FECHA_LEGALES,
          p_telefono: datosAliado.telefono.trim() || null,
        })
      }

      router.push(`/solicitud/${data.token}`)
    } catch {
      setError('No hay conexión. Intenta de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <div className="mt-6">
      <ol className="mb-6 flex gap-2 text-sm" aria-label="Progreso">
        {pasos.map((n) => (
          <li
            key={n}
            className={`flex-1 rounded-full py-1 text-center ${
              n === paso
                ? 'bg-primary font-semibold text-primary-foreground'
                : n < paso
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            Paso {n}
          </li>
        ))}
      </ol>

      {paso === 1 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="municipio" className="mb-1">
              Municipio
            </Label>
            <Combobox
              items={municipios}
              // Sin esto se montan los 1.122 de golpe al abrir: 4.500 nodos y
              // 700 KB de HTML en un solo popup. En iPhone —Safari y Chrome,
              // que ahí son el mismo WebKit— la pestaña se queda sin memoria
              // y se recarga sola. El filtro sigue recorriendo el país
              // entero; esto solo recorta lo que se pinta.
              limit={LIMITE_MUNICIPIOS}
              value={municipios.find((m) => m.codigo_dane === municipio) ?? null}
              onValueChange={elegirMunicipio}
              itemToStringLabel={nombreConDepartamento}
              isItemEqualToValue={(a: Municipio, b: Municipio) => a.codigo_dane === b.codigo_dane}
            >
              <ComboboxTrigger
                id="municipio"
                render={
                  <Button
                    variant="outline"
                    className="w-full justify-between px-3 font-normal"
                  />
                }
              >
                <ComboboxValue placeholder="Busca tu municipio" />
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput showTrigger={false} placeholder="Escribe el nombre" />
                {/* La lista arranca recortada — son 1.122 municipios y
                    pintarlos todos tumbaba la pestaña en iPhone. Quien no
                    vea el suyo tiene que saber que sigue estando.
                    Desaparece en cuanto hay algo escrito: ahí ya se está
                    buscando por nombre, y repetirlo encima de «No
                    encontramos ese municipio» solo confunde. Va por CSS y
                    no por estado para no re-renderizar la lista en cada
                    tecla. */}
                <p className="px-3 pt-2 text-sm text-muted-foreground group-has-[input:not(:placeholder-shown)]/combobox-content:hidden">
                  Si no ves la ciudad, búscala por nombre.
                </p>
                <ComboboxEmpty>No encontramos ese municipio.</ComboboxEmpty>
                <ComboboxList>
                  {(m: Municipio) => (
                    <ComboboxItem key={m.codigo_dane} value={m}>
                      <span className="flex min-w-0 flex-col">
                        <span>{m.nombre}</span>
                        <span className="text-sm text-muted-foreground">{m.departamento}</span>
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <div>
            <Label htmlFor="barrio" className="mb-1">
              Barrio o comuna
            </Label>
            <Input
              id="barrio"
              type="text"
              value={barrio}
              onChange={(e) => setBarrio(e.target.value)}
              maxLength={60}
              placeholder="Ej: Comuna 15, El Vergel"
            />
            {errorBarrio && <p className="mt-1 text-sm text-destructive">{errorBarrio}</p>}
          </div>
          {/* Regla R: esto ANUNCIA, no ofrece un camino alternativo. No hay
              botón, no hay casilla y no hay nada preseleccionado — el único
              botón de esta pantalla sigue siendo «Continuar», que publica
              directo. Los datos se piden después, en la pantalla de la
              solicitud, y solo si la persona vuelve a decir que sí. */}
          {aliados.length > 0 && (
            <Alert>
              <AlertTitle>
                {aliados.length === 1
                  ? `En ${nombreMunicipio} hay una fundación que puede acompañarte`
                  : `En ${nombreMunicipio} hay ${aliados.length} fundaciones que pueden acompañarte`}
              </AlertTitle>
              <AlertDescription>
                {aliados.map((a) => a.nombre).join(' · ')}. {AVISO_ALIADO_MUNICIPIO}
              </AlertDescription>
            </Alert>
          )}

          <Button className="w-full" disabled={!puedeAvanzarPaso1} onClick={() => setPaso(2)}>
            Continuar
          </Button>
        </div>
      )}

      {paso === 2 && (
        <div className="space-y-4">
          <div>
            <Label className="mb-1">Categoría</Label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIAS.map((c) => (
                <Button
                  key={c.valor}
                  type="button"
                  variant={categoria === c.valor ? 'default' : 'outline'}
                  onClick={() => {
                    setCategoria(c.valor)
                    setSeleccionados([])
                  }}
                >
                  {c.etiqueta}
                </Button>
              ))}
            </div>
          </div>

          {/* Pedir un servicio de salud ya insinúa una necesidad de salud.
              La solicitud es anónima, pero el aviso evita que la persona
              agregue por su cuenta el detalle que sí la identificaría. */}
          {categoria === 'servicios' && (
            <Alert variant="warning">
              <AlertDescription>
                Elige el servicio de la lista y nada más. No escribas tu
                diagnóstico, tu enfermedad ni lo que te pasó: quien responda
                no necesita saberlo para ayudarte.
              </AlertDescription>
            </Alert>
          )}

          {categoria && (
            <div>
              <Label className="mb-1">
                {categoria === 'servicios' ? 'Servicios que necesitas' : 'Ítems que necesitas'}
              </Label>
              <ul className="space-y-2">
                {itemsDeCategoria.map((item) => {
                  const sel = seleccionados.find((s) => 'item_id' in s && s.item_id === item.id)
                  return (
                    <li
                      key={item.id}
                      className={`flex items-center gap-2 rounded-lg border p-2 ${
                        sel ? 'border-primary bg-accent' : 'border-border'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => alternarItem(item.id)}
                        aria-pressed={!!sel}
                        className={`min-h-12 flex-1 px-2 text-left text-base ${
                          sel ? 'font-semibold text-accent-foreground' : ''
                        }`}
                      >
                        {sel ? '✓ ' : ''}
                        {item.nombre}
                      </button>
                      {/* Un servicio no se pide por cantidad: se pide o no. */}
                      {sel && item.unidad !== 'servicio' && (
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={9999}
                          value={sel.cantidad === 0 ? '' : sel.cantidad}
                          onChange={(e) => cambiarCantidad(item.id, Number(e.target.value))}
                          onBlur={() => cerrarCantidad(item.id)}
                          className="w-20"
                          aria-label={`Cantidad de ${item.nombre}`}
                        />
                      )}
                      {item.unidad !== 'servicio' && (
                        <span className="w-16 text-sm text-muted-foreground">{item.unidad}</span>
                      )}
                    </li>
                  )
                })}
                {seleccionados.map((s, indice) =>
                  'sugerencia' in s ? (
                    <li
                      key={`sugerencia-${indice}`}
                      className="flex items-center gap-2 rounded-lg border border-primary bg-accent p-2"
                    >
                      <span className="min-h-12 flex-1 px-2 py-2 text-base font-semibold text-accent-foreground">
                        {s.sugerencia}{' '}
                        <span className="font-normal text-muted-foreground">(por confirmar)</span>
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={9999}
                        value={s.cantidad === 0 ? '' : s.cantidad}
                        onChange={(e) => cambiarCantidadSugerencia(indice, Number(e.target.value))}
                        onBlur={() => cerrarCantidadSugerencia(indice)}
                        className="w-20"
                        aria-label={`Cantidad de ${s.sugerencia}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => quitarSugerencia(indice)}
                        aria-label={`Quitar ${s.sugerencia}`}
                      >
                        Quitar
                      </Button>
                    </li>
                  ) : null
                )}
              </ul>

              {mostrarSugerencia ? (
                <div className="mt-2 space-y-2 rounded-lg border border-border p-3">
                  <Label htmlFor="sugerencia" className="mb-1">
                    Escribe el nombre de lo que necesitas
                  </Label>
                  <Input
                    id="sugerencia"
                    type="text"
                    value={textoSugerencia}
                    onChange={(e) => setTextoSugerencia(e.target.value)}
                    maxLength={60}
                    placeholder="Ej: Crema dental"
                  />
                  {errorSugerencia && <p className="text-sm text-destructive">{errorSugerencia}</p>}
                  <p className="text-sm text-muted-foreground">
                    Escribe solo el nombre de la cosa, nada más. Una persona lo
                    va a revisar; mientras tanto tu solicitud se publica igual.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setMostrarSugerencia(false)
                        setTextoSugerencia('')
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      className="flex-1"
                      disabled={!puedeAgregarSugerencia}
                      onClick={agregarSugerencia}
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full"
                  disabled={numSugerencias >= MAX_SUGERENCIAS || seleccionados.length >= 12}
                  onClick={() => setMostrarSugerencia(true)}
                >
                  No encuentro lo que necesito
                </Button>
              )}
              {numSugerencias >= MAX_SUGERENCIAS && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Ya agregaste el máximo de 3 ítems por confirmar.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setPaso(1)}>
              Atrás
            </Button>
            {/* Cierra los campos de cantidad que quedaran vacíos antes de
                pasar de pantalla. No se hace deshabilitando «Continuar»:
                un botón deshabilitado no recibe el toque, así que haría
                falta tocar dos veces —una para cerrar el campo y otra para
                avanzar— y eso se siente como que la app no responde. */}
            <Button
              type="button"
              className="flex-1"
              disabled={!puedeAvanzarPaso2}
              onClick={() => {
                setSeleccionados((prev) =>
                  prev.map((s) => (s.cantidad === 0 ? { ...s, cantidad: 1 } : s))
                )
                setPaso(3)
              }}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="nota" className="mb-1">
              Nota opcional (máx. 140 caracteres)
            </Label>
            <Textarea
              id="nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={140}
              rows={3}
              placeholder="Ej: Es para dos adultos mayores"
            />
            <p className="mt-1 text-sm text-muted-foreground">{nota.length}/140</p>
            {errorNota && <p className="text-sm text-destructive">{errorNota}</p>}
          </div>

          {/* Siempre en positivo, y opcional. No hay «no puedo recoger»: eso
              sería declarar en público que a alguien le cuesta moverse, y no
              se guarda ni se pregunta. Tampoco sale en el tablero: solo lo
              ven quien va a responder y la fundación, que es para quienes
              sirve. */}
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-accent">
            <input
              type="checkbox"
              checked={puedeRecoger}
              onChange={(e) => setPuedeRecoger(e.target.checked)}
              className="mt-0.5 size-6 shrink-0"
            />
            <span>
              <span className="text-base font-medium">Puedo recoger</span>
              <span className="block text-sm text-muted-foreground">
                Puedes desplazarte a buscar lo que pediste. Así nadie tiene que
                preguntártelo después.
              </span>
            </span>
          </label>

          {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setPaso(2)}>
              Atrás
            </Button>
            {hayCuartoPaso ? (
              <Button
                type="button"
                className="flex-1"
                disabled={!puedeEnviar}
                onClick={() => setPaso(4)}
              >
                Continuar
              </Button>
            ) : (
              <Button type="button" className="flex-1" disabled={!puedeEnviar} onClick={enviar}>
                {enviando ? 'Publicando…' : 'Publicar solicitud'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Paso 4: el acompañamiento, donde sí se ve.
          Estuvo un rato solo en la pantalla de la solicitud, después de
          publicar, y ahí casi nadie llegaba a tocarlo.

          La regla R se sostiene por la forma, no por el sitio: el botón
          grande y el que está a la derecha es «Publicar sin esto», el
          formulario empieza cerrado, no hay nada preseleccionado y la
          opción anónima no se pinta como la mala. Lo que cambia es que
          ahora se ve. */}
      {paso === 4 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-heading text-2xl">
              {aliados.length === 1
                ? `${aliados[0].nombre} puede acompañarte`
                : `En ${nombreMunicipio} hay fundaciones que pueden acompañarte`}
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Coordinan la entrega y la recibes en su punto de acopio, sin
              tener que encontrarte con nadie que no conozcas. Es opcional: si
              no quieres, tu solicitud se publica igual y sin ningún dato tuyo.
            </p>
          </div>

          {!conAliado ? (
            <button
              type="button"
              onClick={() => setConAliado(true)}
              className="flex min-h-12 items-center gap-1.5 text-left text-base text-primary underline"
            >
              <HeartHandshake className="size-4 shrink-0" aria-hidden="true" />
              Quiero que una fundación coordine la entrega
            </button>
          ) : (
            <div className="rounded-xl border border-border p-4">
              <CamposAcompanamiento
                aliados={aliados}
                datos={datosAliado}
                onCambio={setDatosAliado}
              />
              <button
                type="button"
                onClick={() => {
                  setConAliado(false)
                  setDatosAliado(
                    aliados.length === 1
                      ? { ...DATOS_VACIOS, organizacionId: aliados[0].id }
                      : DATOS_VACIOS
                  )
                }}
                className="mt-4 flex min-h-12 items-center text-base text-muted-foreground underline"
              >
                Mejor no, publicar sin esto
              </button>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setPaso(3)}>
              Atrás
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!puedeEnviar || (conAliado && !datosCompletos(datosAliado))}
              onClick={enviar}
            >
              {enviando
                ? 'Publicando…'
                : conAliado
                  ? 'Publicar con acompañamiento'
                  : 'Publicar sin esto'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
