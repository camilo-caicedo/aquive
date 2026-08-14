'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Categoria, ItemCatalogoPublico, ItemSolicitudInput } from '@/lib/types'
import type { MunicipioBasico as Municipio } from '@/lib/municipios'
import { CATEGORIAS } from '@/lib/catalogo'
import { validarBarrio, validarNota, validarSugerencia } from '@/lib/validacion'
import { TurnstileWidget } from '@/components/turnstile-widget'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
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
          ? { ...s, cantidad: Math.min(9999, Math.max(1, cantidad)) }
          : s
      )
    )
  }

  // Las sugerencias no tienen un id de catálogo para identificarlas: se
  // ubican por su posición en `seleccionados`, que no cambia de orden.
  function cambiarCantidadSugerencia(indice: number, cantidad: number) {
    setSeleccionados((prev) =>
      prev.map((s, i) => (i === indice ? { ...s, cantidad: Math.min(9999, Math.max(1, cantidad)) } : s))
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
          items: seleccionados,
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
      router.push(`/solicitud/${data.token}`)
    } catch {
      setError('No hay conexión. Intenta de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <div className="mt-6">
      <ol className="mb-6 flex gap-2 text-sm" aria-label="Progreso">
        {[1, 2, 3].map((n) => (
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
              value={municipios.find((m) => m.codigo_dane === municipio) ?? null}
              onValueChange={(m: Municipio | null) => setMunicipio(m?.codigo_dane ?? '')}
              itemToStringLabel={(m: Municipio) => m.nombre}
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
              <AlertDescription className="text-amber-900">
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
                          value={sel.cantidad}
                          onChange={(e) => cambiarCantidad(item.id, Number(e.target.value))}
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
                        value={s.cantidad}
                        onChange={(e) => cambiarCantidadSugerencia(indice, Number(e.target.value))}
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
            <Button type="button" className="flex-1" disabled={!puedeAvanzarPaso2} onClick={() => setPaso(3)}>
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
            <Button type="button" className="flex-1" disabled={!puedeEnviar} onClick={enviar}>
              {enviando ? 'Publicando…' : 'Publicar solicitud'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
