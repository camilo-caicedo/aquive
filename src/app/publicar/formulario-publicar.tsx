'use client'

import { useMemo, useState } from 'react'
import { rpc } from '@/orpc/cliente'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Minus, Plus, ShieldAlert } from 'lucide-react'
import type { Categoria, ItemCatalogoPublico, ItemSolicitudInput } from '@/lib/types'
import { LIMITE_MUNICIPIOS, nombreConDepartamento, type MunicipioBasico as Municipio } from '@/lib/municipios'
import { categoria as categoriaInfo, CATEGORIAS } from '@/lib/catalogo'
import { FECHA_LEGALES } from '@/lib/config'
import { validarBarrio, validarCorreo, validarNota, validarSugerencia, validarTelefono } from '@/lib/validacion'
import { TurnstileWidget } from '@/components/turnstile-widget'
import { Button } from '@/components/ui/button'
import { MarcoFlujo } from '@/components/marco-flujo'
import { SeccionPlegable } from '@/components/seccion-plegable'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAviso } from '@/components/avisos'
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
  const avisar = useAviso()
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [municipio, setMunicipio] = useState('')
  const [barrio, setBarrio] = useState('')
  const [categoria, setCategoria] = useState<Categoria | ''>('')
  const [seleccionados, setSeleccionados] = useState<ItemSolicitudInput[]>([])
  const [mostrarSugerencia, setMostrarSugerencia] = useState(false)
  const [textoSugerencia, setTextoSugerencia] = useState('')
  const [nota, setNota] = useState('')
  // Contacto opcional (paso 3): excepción explícita a la regla 1 de
  // CLAUDE.md, pedida el 17 de agosto de 2026 — ver
  // supabase/migraciones/v2-k4-contacto-solicitante.sql. Los tres campos
  // son opcionales de verdad: nada aquí bloquea publicar sin ellos.
  const [contactoNombre, setContactoNombre] = useState('')
  const [contactoTelefono, setContactoTelefono] = useState('')
  const [contactoCorreo, setContactoCorreo] = useState('')
  const [contactoAcepto, setContactoAcepto] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [puedeRecoger, setPuedeRecoger] = useState(false)
  // ⚠ Aquí se preguntaba qué fundación podía acompañar esta solicitud y se
  // recogían el nombre y el documento de quien pedía, cifrados. Se fue con
  // el ADR 0007: ya no hay fundaciones aliadas, y con ellas se fue el único
  // sitio de la aplicación que pedía un documento de identidad.
  function elegirMunicipio(m: Municipio | null) {
    setMunicipio(m?.codigo_dane ?? '')
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
  const errorContactoTelefono = contactoTelefono ? validarTelefono(contactoTelefono) : null
  const errorContactoCorreo = contactoCorreo ? validarCorreo(contactoCorreo) : null
  const contactoTieneDatos =
    contactoNombre.trim() !== '' || contactoTelefono.trim() !== '' || contactoCorreo.trim() !== ''
  const puedeAvanzarContacto =
    !errorContactoTelefono && !errorContactoCorreo && (!contactoTieneDatos || contactoAcepto)
  const puedeEnviar =
    puedeAvanzarPaso1 &&
    puedeAvanzarPaso2 &&
    puedeAvanzarContacto &&
    !errorNota &&
    turnstileToken !== null &&
    !enviando

  const NOMBRES_PASO = ['Dónde', 'Qué necesitas', 'Revisar']

  async function enviar() {
    if (!puedeEnviar) return
    setEnviando(true)
    setError(null)
    try {
      // Va por el contrato, no por una ruta de API con PL/pgSQL detrás
      // (ADR 0001). La solicitud cuelga de la cuenta (ADR 0006), así que ya
      // no hay token que guardar en este teléfono ni enlace que copiar.
      await rpc.insumos.publicar({
        municipio,
        barrio: barrio.trim(),
        categoria,
        nota: nota.trim() || undefined,
        // Último filtro por si algún campo de cantidad llegó vacío hasta
        // aquí: `0` es «no escribí nada todavía», nunca una cantidad.
        items: seleccionados.map((s) => (s.cantidad === 0 ? { ...s, cantidad: 1 } : s)),
        puede_recoger: puedeRecoger,
      })

      avisar('Solicitud publicada')
      router.push('/mis-solicitudes')
      router.refresh()
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo publicar la solicitud')
      setEnviando(false)
    }
  }

  // Una barra de acción por paso. Antes cada paso repetía su propio par de
  // botones al final del cuerpo, así que en un formulario largo quedaban a
  // dos pantallas de donde se estaba escribiendo.
  //
  // Regla R al pie de la letra: el botón grande publica directo, no hay nada
  // preseleccionado, y la opción anónima no se pinta como la mala.
  const acciones =
    paso === 1 ? (
      <Button className="w-full" disabled={!puedeAvanzarPaso1} onClick={() => setPaso(2)}>
        Continuar
      </Button>
    ) : paso === 2 ? (
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => setPaso(1)}>
          Atrás
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={!puedeAvanzarPaso2}
          onClick={() => {

            setPaso(3)
          }}
        >
          Continuar
        </Button>
      </div>
    ) : (
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => setPaso(2)}>
          Atrás
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={!puedeEnviar}
          onClick={enviar}
        >
          {enviando ? 'Publicando…' : 'Publicar solicitud'}
        </Button>
      </div>
    )

  // El aviso del paso 1, que estaba en la página: va donde se escribe el
  // barrio, no encima de los tres pasos.
  const avisoSinDatos = (
    <Alert variant="warning">
      <ShieldAlert className="size-5" aria-hidden="true" />
      <AlertDescription>
        No escribas tu nombre, teléfono ni dirección exacta. Con el barrio
        basta.
      </AlertDescription>
    </Alert>
  )

  return (
    // El marco lo monta el formulario y no la página: el progreso y la barra
    // de acción son del paso, y el paso solo lo sabe este componente.
    <MarcoFlujo
      titulo="Pedir ayuda"
      volver="/inicio"
      pasos={NOMBRES_PASO}
      pasoActual={paso - 1}
      accion={acciones}
    >
    <div>


      {paso === 1 && (
        <div className="space-y-4">
          {avisoSinDatos}
          <div>
            <Label htmlFor="municipio" className="mb-1">
              ¿En qué municipio estás?
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
              <ComboboxTrigger id="municipio">
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
        </div>
      )}

      {paso === 2 && (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-base font-medium">¿Qué tipo de ayuda?</legend>
            {/* Chips con el icono de la categoría, no una rejilla de botones
                del mismo tamaño que los de navegar: son seis y se eligen de
                un vistazo. */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map((c) => {
                const { Icono } = categoriaInfo(c.valor)
                const elegida = categoria === c.valor
                return (
                  <button
                    key={c.valor}
                    type="button"
                    aria-pressed={elegida}
                    onClick={() => {
                      setCategoria(c.valor)
                      setSeleccionados([])
                    }}
                    className={`inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-base transition-colors ${
                      elegida
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : 'bg-card text-foreground shadow-canto hover:bg-muted'
                    }`}
                  >
                    <Icono className="size-5 shrink-0" aria-hidden="true" />
                    {c.etiqueta}
                  </button>
                )
              })}
            </div>
          </fieldset>

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
                  const cantidad = sel ? (sel.cantidad === 0 ? 1 : sel.cantidad) : 0
                  return (
                    // Una fila de ancho completo por ítem, no un chip: el
                    // nombre y el stepper caben en la misma línea y la lista
                    // se recorre con el pulgar sin apuntar.
                    <li
                      key={item.id}
                      className={`flex min-h-14 items-center gap-2 rounded-full pr-2 pl-4 transition-colors ${
                        sel
                          ? 'border border-enlace bg-accent'
                          : 'shadow-canto bg-card'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => alternarItem(item.id)}
                        aria-pressed={!!sel}
                        className="flex min-h-12 min-w-0 flex-1 items-center gap-1.5 text-left text-base"
                      >
                        <span
                          className={sel ? 'truncate font-semibold text-accent-foreground' : 'truncate'}
                        >
                          {item.nombre}
                        </span>
                        {sel && item.unidad !== 'servicio' && (
                          <span className="shrink-0 text-sm text-muted-foreground">
                            · {item.unidad}
                          </span>
                        )}
                      </button>

                      {/* Un servicio no se pide por cantidad: se pide o no. */}
                      {sel && item.unidad !== 'servicio' ? (
                        <span className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => cambiarCantidad(item.id, Math.max(1, cantidad - 1))}
                            disabled={cantidad <= 1}
                            aria-label={`Quitar uno de ${item.nombre}`}
                            className="flex size-10 items-center justify-center rounded-full bg-card text-foreground disabled:opacity-40"
                          >
                            <Minus className="size-4" aria-hidden="true" />
                          </button>
                          <span
                            aria-live="polite"
                            aria-label={`Cantidad de ${item.nombre}`}
                            className="min-w-8 text-center text-base font-semibold tabular-nums"
                          >
                            {cantidad}
                          </span>
                          <button
                            type="button"
                            onClick={() => cambiarCantidad(item.id, cantidad + 1)}
                            disabled={cantidad >= 9999}
                            aria-label={`Agregar uno de ${item.nombre}`}
                            className="flex size-10 items-center justify-center rounded-full bg-card text-foreground disabled:opacity-40"
                          >
                            <Plus className="size-4" aria-hidden="true" />
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => alternarItem(item.id)}
                          aria-label={`Agregar ${item.nombre}`}
                          className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                        >
                          {sel ? (
                            <Check className="size-5 text-enlace" aria-hidden="true" />
                          ) : (
                            <Plus className="size-5" aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </li>
                  )
                })}
                {seleccionados.map((s, indice) =>
                  'sugerencia' in s ? (
                    <li
                      key={`sugerencia-${indice}`}
                      className="flex items-center gap-2 rounded-2xl border border-enlace bg-accent p-2"
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
                <div className="shadow-canto mt-2 space-y-2 rounded-2xl bg-card p-3">
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
                <button
                  type="button"
                  disabled={numSugerencias >= MAX_SUGERENCIAS || seleccionados.length >= 12}
                  onClick={() => setMostrarSugerencia(true)}
                  className="mt-2 inline-flex min-h-12 items-center gap-1.5 text-base text-enlace underline underline-offset-4 disabled:opacity-50 disabled:no-underline"
                >
                  <Plus className="size-4 shrink-0" aria-hidden="true" />
                  No encuentro lo que necesito
                </button>
              )}
              {numSugerencias >= MAX_SUGERENCIAS && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Ya agregaste el máximo de 3 ítems por confirmar.
                </p>
              )}
            </div>
          )}

        </div>
      )}

      {paso === 3 && (
        <div className="space-y-4">
          {/* Lo que se va a publicar, antes de nada: es la respuesta a
              «¿esto es lo que pedí?», y con tres pasos atrás es lo que
              evita volver a mirar. */}
          <div className="rounded-2xl bg-card p-4 shadow-canto">
            <p className="text-lg font-bold">Vas a publicar</p>
            <p className="mt-1 text-base text-muted-foreground">
              {[
                categoria ? categoriaInfo(categoria).etiqueta : null,
                municipios.find((m) => m.codigo_dane === municipio)?.nombre,
                barrio.trim() || null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {seleccionados.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {seleccionados.map((s, i) => (
                  <li
                    key={i}
                    className="rounded-full bg-muted px-3.5 py-1.5 text-sm text-foreground"
                  >
                    {'item_id' in s
                      ? `${s.cantidad || 1} ${
                          items.find((it) => it.id === s.item_id)?.nombre ?? ''
                        }`
                      : `${s.cantidad || 1} ${s.sugerencia}`}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setPaso(2)}
              className="mt-2 inline-flex min-h-12 items-center text-base text-enlace underline underline-offset-4"
            >
              Cambiar
            </button>
          </div>

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
          <label className="shadow-canto flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-transparent bg-card p-3 has-checked:border-enlace has-checked:bg-accent has-checked:shadow-none">
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


          {/* El contacto y el acompañamiento dejan de ser pasos: eran dos
              pantallas enteras que la mayoría atravesaba sin tocar nada, y
              cada una de ellas es opcional. Van aquí, cerradas, donde se
              revisa antes de publicar. */}
          <SeccionPlegable
            titulo="Dejar un contacto directo (opcional)"
            resumen={
              contactoNombre || contactoTelefono || contactoCorreo
                ? 'Vas a compartir un dato de contacto'
                : 'No hace falta. Tu solicitud se publica sin datos tuyos'
            }
          >
            <div>
              <h2 className="font-heading text-2xl">Contacto (opcional)</h2>
              <p className="mt-1 text-base text-muted-foreground">
                Nada de esto es obligatorio. Si dejas algo, quien responda tu
                solicitud y el administrador de AquíVe van a poder escribirte
                directamente.
              </p>
            </div>

            <div>
              <Label htmlFor="contacto-nombre" className="mb-1">
                Nombre (opcional)
              </Label>
              <Input
                id="contacto-nombre"
                value={contactoNombre}
                onChange={(e) => setContactoNombre(e.target.value)}
                maxLength={80}
                autoComplete="name"
              />
            </div>

            <div>
              <Label htmlFor="contacto-telefono" className="mb-1">
                Teléfono (opcional)
              </Label>
              <Input
                id="contacto-telefono"
                value={contactoTelefono}
                onChange={(e) => setContactoTelefono(e.target.value)}
                maxLength={20}
                inputMode="tel"
                autoComplete="tel"
              />
              {errorContactoTelefono && (
                <p className="mt-1 text-sm text-destructive">{errorContactoTelefono}</p>
              )}
            </div>

            <div>
              <Label htmlFor="contacto-correo" className="mb-1">
                Correo (opcional)
              </Label>
              <Input
                id="contacto-correo"
                type="email"
                value={contactoCorreo}
                onChange={(e) => setContactoCorreo(e.target.value)}
                maxLength={120}
                autoComplete="email"
              />
              {errorContactoCorreo && (
                <p className="mt-1 text-sm text-destructive">{errorContactoCorreo}</p>
              )}
            </div>

            {contactoTieneDatos && (
              <label className="flex items-start gap-2 text-base">
                <input
                  type="checkbox"
                  checked={contactoAcepto}
                  onChange={(e) => setContactoAcepto(e.target.checked)}
                  className="mt-1 size-5 shrink-0"
                />
                <span>
                  Acepto que este contacto se muestre a quien responda esta
                  solicitud y al administrador de AquíVe, según el{' '}
                  <Link href="/privacidad" className="text-enlace underline underline-offset-4">
                    aviso de privacidad
                  </Link>{' '}
                  del {FECHA_LEGALES}.
                </span>
              </label>
            )}
          </SeccionPlegable>

          {/* ⚠ Aquí iba «que una fundación acompañe la entrega». Se fue con
              el ADR 0007: ya no hay fundaciones aliadas. Era el único sitio
              del sitio que pedía nombre y documento de quien pide. */}

          {/* Al final: es una comprobación de que no eres un robot, no una
              decisión tuya, y en medio partía en dos las tres cosas que sí
              lo son. */}
          {turnstileSiteKey && (
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

        </div>
      )}
    </div>
    </MarcoFlujo>
  )
}
