'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validarEnlace } from '@/lib/validacion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import type { CoberturaEntidad, Database, EnlaceEntidad, Json } from '@/lib/types'
import { LIMITE_MUNICIPIOS, nombreConDepartamento, type MunicipioBasico as Municipio } from '@/lib/municipios'

// Exactamente los campos de `COLUMNAS_ENTIDAD_ADMIN` (src/lib/types.ts):
// nunca `creada_por`, que es el uuid de una persona real.
export type EntidadAdmin = Pick<
  Database['public']['Tables']['entidades']['Row'],
  | 'id'
  | 'nombre'
  | 'subtitulo'
  | 'descripcion'
  | 'enlaces'
  | 'pie'
  | 'cobertura'
  | 'municipios'
  | 'orden'
  | 'activa'
>

const MAX_ENLACES = 6

function FormularioEntidad({
  entidad,
  municipios,
  onCancelar,
  onGuardado,
}: {
  entidad: EntidadAdmin | null
  municipios: Municipio[]
  onCancelar: () => void
  onGuardado: () => void
}) {
  const router = useRouter()
  const [nombre, setNombre] = useState(entidad?.nombre ?? '')
  const [subtitulo, setSubtitulo] = useState(entidad?.subtitulo ?? '')
  const [descripcion, setDescripcion] = useState(entidad?.descripcion ?? '')
  const [pie, setPie] = useState(entidad?.pie ?? '')
  const [cobertura, setCobertura] = useState<CoberturaEntidad>(entidad?.cobertura ?? 'nacional')
  const [municipiosSel, setMunicipiosSel] = useState<string[]>(entidad?.municipios ?? [])
  const [orden, setOrden] = useState(entidad?.orden ?? 0)
  const [enlaces, setEnlaces] = useState<EnlaceEntidad[]>(
    entidad && entidad.enlaces.length > 0 ? entidad.enlaces : [{ etiqueta: '', url: '' }]
  )
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const municipiosElegidos = municipios.filter((m) => municipiosSel.includes(m.codigo_dane))

  function actualizarEnlace(i: number, campo: keyof EnlaceEntidad, valor: string) {
    setEnlaces((prev) => prev.map((e, idx) => (idx === i ? { ...e, [campo]: valor } : e)))
  }

  function agregarEnlace() {
    setEnlaces((prev) => (prev.length >= MAX_ENLACES ? prev : [...prev, { etiqueta: '', url: '' }]))
  }

  function quitarEnlace(i: number) {
    setEnlaces((prev) => prev.filter((_, idx) => idx !== i))
  }

  function moverEnlace(i: number, direccion: -1 | 1) {
    setEnlaces((prev) => {
      const destino = i + direccion
      if (destino < 0 || destino >= prev.length) return prev
      const copia = [...prev]
      ;[copia[i], copia[destino]] = [copia[destino], copia[i]]
      return copia
    })
  }

  const nombreValido = nombre.trim().length >= 3 && nombre.trim().length <= 80
  const municipiosValidos = cobertura === 'nacional' || municipiosSel.length > 0
  const puedeGuardar = nombreValido && municipiosValidos && !enviando

  async function guardar() {
    if (!puedeGuardar) return
    setEnviando(true)
    setError(null)

    // Una fila vacía es un "Agregar enlace" del que alguien se arrepintió,
    // no un error: se descarta antes de validar, no al validar.
    const enlacesLimpios = enlaces.filter((e) => e.etiqueta.trim() || e.url.trim())
    for (const e of enlacesLimpios) {
      const errorEnlace = validarEnlace(e.etiqueta, e.url)
      if (errorEnlace) {
        setError(errorEnlace)
        setEnviando(false)
        return
      }
    }

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('guardar_entidad', {
      p_id: entidad?.id ?? null,
      p_nombre: nombre.trim(),
      p_subtitulo: subtitulo.trim() || null,
      p_descripcion: descripcion.trim() || null,
      p_enlaces: enlacesLimpios as unknown as Json,
      p_pie: pie.trim() || null,
      p_cobertura: cobertura,
      p_municipios: cobertura === 'local' ? municipiosSel : [],
      p_orden: orden,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    onGuardado()
    router.refresh()
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <Label htmlFor="entidad-nombre" className="mb-1">
          Nombre
        </Label>
        <Input
          id="entidad-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={80}
          placeholder="Ej: Cruz Roja Colombiana"
        />
      </div>

      <div>
        <Label htmlFor="entidad-subtitulo" className="mb-1">
          Subtítulo (opcional)
        </Label>
        <Input
          id="entidad-subtitulo"
          value={subtitulo}
          onChange={(e) => setSubtitulo(e.target.value)}
          maxLength={120}
          placeholder="Ej: Ayuda humanitaria"
        />
      </div>

      <div>
        <Label htmlFor="entidad-descripcion" className="mb-1">
          Descripción (opcional)
        </Label>
        <Textarea
          id="entidad-descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={600}
          rows={3}
        />
        <p className="mt-1 text-sm text-muted-foreground">{descripcion.length}/600</p>
      </div>

      <fieldset>
        <legend className="mb-2 text-base font-medium">Cobertura</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant={cobertura === 'nacional' ? 'default' : 'outline'}
            onClick={() => setCobertura('nacional')}
          >
            Nacional
          </Button>
          <Button
            type="button"
            variant={cobertura === 'local' ? 'default' : 'outline'}
            onClick={() => setCobertura('local')}
          >
            Local
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Usa Nacional también para un servicio virtual, sin sede en un
          municipio en particular.
        </p>
      </fieldset>

      {cobertura === 'local' && (
        <div>
          <Label className="mb-2">Municipios donde trabaja</Label>
          <Combobox
            multiple
            items={municipios}
            limit={LIMITE_MUNICIPIOS}
            value={municipiosElegidos}
            onValueChange={(ms: Municipio[]) => setMunicipiosSel(ms.map((m) => m.codigo_dane))}
            itemToStringLabel={nombreConDepartamento}
            isItemEqualToValue={(a: Municipio, b: Municipio) => a.codigo_dane === b.codigo_dane}
          >
            <ComboboxChips className="min-h-12 py-2">
              {municipiosElegidos.map((m) => (
                <ComboboxChip key={m.codigo_dane} className="h-8 px-2 text-sm">
                  {nombreConDepartamento(m)}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                placeholder={
                  municipiosElegidos.length === 0 ? 'Escribe para buscar un municipio' : ''
                }
                className="min-h-8 text-base"
              />
            </ComboboxChips>
            <ComboboxContent>
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
          {!municipiosValidos && (
            <p className="mt-1 text-sm text-destructive">
              Una entidad local necesita al menos un municipio.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label className="mb-1">Enlaces (hasta {MAX_ENLACES})</Label>
        <div className="space-y-2">
          {enlaces.map((en, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <Input
                value={en.etiqueta}
                onChange={(e) => actualizarEnlace(i, 'etiqueta', e.target.value)}
                maxLength={40}
                placeholder="Texto del botón, ej: Sitio web"
              />
              <Input
                value={en.url}
                onChange={(e) => actualizarEnlace(i, 'url', e.target.value)}
                maxLength={200}
                placeholder="https://…"
              />
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={i === 0}
                  onClick={() => moverEnlace(i, -1)}
                >
                  Subir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={i === enlaces.length - 1}
                  onClick={() => moverEnlace(i, 1)}
                >
                  Bajar
                </Button>
                <Button type="button" variant="destructive" onClick={() => quitarEnlace(i)}>
                  Quitar
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={enlaces.length >= MAX_ENLACES}
          onClick={agregarEnlace}
        >
          + Agregar enlace
        </Button>
        <p className="text-sm text-muted-foreground">
          El orden de la lista es el orden en que aparecen los botones. Solo
          se aceptan direcciones que empiecen por https://.
        </p>
      </div>

      <div>
        <Label htmlFor="entidad-pie" className="mb-1">
          Pie (opcional)
        </Label>
        <Textarea
          id="entidad-pie"
          value={pie}
          onChange={(e) => setPie(e.target.value)}
          maxLength={400}
          rows={2}
          placeholder="Horarios, aclaraciones u otra nota de cierre"
        />
        <p className="mt-1 text-sm text-muted-foreground">{pie.length}/400</p>
      </div>

      <div>
        <Label htmlFor="entidad-orden" className="mb-1">
          Orden
        </Label>
        <Input
          id="entidad-orden"
          type="number"
          inputMode="numeric"
          value={orden}
          onChange={(e) => setOrden(Number(e.target.value) || 0)}
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Las entidades se muestran de menor a mayor orden. Empata por
          nombre.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button disabled={!puedeGuardar} onClick={guardar}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button variant="outline" disabled={enviando} onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

function AccionesEntidad({
  entidad,
  onEditar,
}: {
  entidad: EntidadAdmin
  onEditar: () => void
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function alternarActiva() {
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('activar_entidad', {
      p_id: entidad.id,
      p_activa: !entidad.activa,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    router.refresh()
  }

  async function borrar() {
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('borrar_entidad', {
      p_id: entidad.id,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="mt-3">
      {confirmando ? (
        <>
          <p className="text-base font-medium text-destructive">
            ¿Seguro? Esto borra la entidad para siempre. No se puede deshacer.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="destructive" disabled={enviando} onClick={borrar}>
              {enviando ? 'Borrando…' : 'Sí, borrar'}
            </Button>
            <Button
              variant="outline"
              disabled={enviando}
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button variant="outline" disabled={enviando} onClick={onEditar}>
            Editar
          </Button>
          <Button variant="outline" disabled={enviando} onClick={alternarActiva}>
            {enviando ? 'Guardando…' : entidad.activa ? 'Retirar' : 'Publicar'}
          </Button>
          <Button variant="destructive" disabled={enviando} onClick={() => setConfirmando(true)}>
            Borrar
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function FichaEntidad({
  entidad,
  onEditar,
}: {
  entidad: EntidadAdmin
  onEditar: () => void
}) {
  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-bold">{entidad.nombre}</span>
        <span
          className={
            entidad.activa
              ? 'inline-flex shrink-0 items-center rounded-full border border-ok/30 bg-ok-suave px-2.5 py-0.5 text-base font-medium text-ok'
              : 'inline-flex shrink-0 items-center rounded-full border border-primary/25 bg-accent px-2.5 py-0.5 text-base font-medium text-accent-foreground'
          }
        >
          {entidad.activa ? 'Publicada' : 'Retirada'}
        </span>
      </div>
      <p className="mt-1 text-base text-muted-foreground">
        {entidad.cobertura === 'nacional'
          ? 'Nacional'
          : `Local · ${entidad.municipios.length} ${
              entidad.municipios.length === 1 ? 'municipio' : 'municipios'
            }`}
        {' · '}
        {entidad.enlaces.length} {entidad.enlaces.length === 1 ? 'enlace' : 'enlaces'}
      </p>
      <AccionesEntidad entidad={entidad} onEditar={onEditar} />
    </li>
  )
}

export function PanelEntidades({
  entidades,
  municipios,
}: {
  entidades: EntidadAdmin[]
  municipios: Municipio[]
}) {
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  return (
    <div className="mt-3 space-y-3">
      {creando ? (
        <FormularioEntidad
          entidad={null}
          municipios={municipios}
          onCancelar={() => setCreando(false)}
          onGuardado={() => setCreando(false)}
        />
      ) : (
        editandoId === null && (
          <Button variant="outline" onClick={() => setCreando(true)}>
            + Nueva entidad
          </Button>
        )
      )}

      {entidades.length === 0 && !creando ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-base text-muted-foreground">
          No hay entidades en el directorio.
        </p>
      ) : (
        <ul className="space-y-3">
          {entidades.map((e) =>
            editandoId === e.id ? (
              <li key={e.id}>
                <FormularioEntidad
                  entidad={e}
                  municipios={municipios}
                  onCancelar={() => setEditandoId(null)}
                  onGuardado={() => setEditandoId(null)}
                />
              </li>
            ) : (
              <FichaEntidad key={e.id} entidad={e} onEditar={() => setEditandoId(e.id)} />
            )
          )}
        </ul>
      )}
    </div>
  )
}
