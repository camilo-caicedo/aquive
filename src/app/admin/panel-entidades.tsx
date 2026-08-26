'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TriangleAlert, ArrowUp, ArrowDown, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { validarEnlace } from '@/lib/validacion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { HojaAccion } from '@/components/hoja-accion'
import { HojaGestion } from '@/components/hoja-gestion'
import { useContenedorHoja } from '@/components/contenedor-hoja'
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
import {
  LIMITE_MUNICIPIOS,
  nombreConDepartamento,
  type MunicipioBasico as Municipio,
} from '@/lib/municipios'

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

/**
 * El formulario de una entidad, dentro de una hoja.
 *
 * Antes vivía encima de la lista, siempre abierto, y editar una entidad
 * reemplazaba su fila por nueve campos con enlaces anidados: la lista
 * desaparecía justo cuando hacía falta compararla.
 */
function FormularioEntidad({
  entidad,
  municipios,
  hojaId,
}: {
  entidad: EntidadAdmin | null
  municipios: Municipio[]
  /** El popover que hay que cerrar al guardar o al cancelar. */
  hojaId: string
}) {
  const router = useRouter()
  const contenedor = useContenedorHoja()
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
  // `guardar_entidad` recibe el arreglo vacío si no hay ninguno, así que
  // una entidad local sin municipios se guardaría sin cobertura.
  const municipiosValidos = cobertura === 'nacional' || municipiosSel.length > 0
  const puedeGuardar = nombreValido && municipiosValidos && !enviando

  function cerrar() {
    ;(document.getElementById(hojaId) as HTMLElement & { hidePopover?: () => void })?.hidePopover?.()
  }

  async function guardar() {
    if (!puedeGuardar) return
    setEnviando(true)
    setError(null)

    // Una fila vacía es un «Agregar enlace» del que alguien se arrepintió,
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

    setEnviando(false)
    cerrar()
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`nombre-${hojaId}`} className="mb-1">
          Nombre
        </Label>
        <Input
          id={`nombre-${hojaId}`}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={80}
          placeholder="Ej: Cruz Roja Colombiana"
        />
      </div>

      <div>
        <Label htmlFor={`subtitulo-${hojaId}`} className="mb-1">
          Subtítulo (opcional)
        </Label>
        <Input
          id={`subtitulo-${hojaId}`}
          value={subtitulo}
          onChange={(e) => setSubtitulo(e.target.value)}
          maxLength={120}
          placeholder="Ej: Ayuda humanitaria"
        />
      </div>

      <div>
        <Label htmlFor={`descripcion-${hojaId}`} className="mb-1">
          Descripción (opcional)
        </Label>
        <Textarea
          id={`descripcion-${hojaId}`}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={600}
          rows={3}
          placeholder="Qué hace la organización, en dos o tres líneas"
        />
        <p className="mt-1 text-base text-muted-foreground">
          {descripcion.length}/600 · es el párrafo que se lee en su ficha del
          directorio
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-base font-medium">Cobertura</legend>
        <div className="grid grid-cols-2 gap-2">
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
        <p className="mt-2 text-base text-muted-foreground">
          Una entidad nacional sale siempre, filtre por donde filtre quien
          busca. Usa Nacional también para un servicio virtual, sin sede en un
          municipio.
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
                  municipiosElegidos.length === 0 ? 'Buscar municipio…' : ''
                }
                className="min-h-8 text-base"
              />
            </ComboboxChips>
            {/* Dentro de una hoja la lista tiene que portalizarse al propio
                popover, o se pinta debajo de la capa superior. */}
            <ComboboxContent container={contenedor}>
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
          <p className="mt-1 text-base text-muted-foreground">
            Solo con cobertura local, y hace falta al menos uno: sin
            municipios, una entidad local se guardaría sin cobertura.
          </p>
          {!municipiosValidos && (
            <p className="mt-1 text-base text-destructive">
              Una entidad local necesita al menos un municipio.
            </p>
          )}
        </div>
      )}

      <div>
        <Label className="mb-2">Enlaces</Label>
        <div className="space-y-2">
          {enlaces.map((en, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <Input
                value={en.etiqueta}
                onChange={(e) => actualizarEnlace(i, 'etiqueta', e.target.value)}
                maxLength={40}
                aria-label={`Texto del botón ${i + 1}`}
                placeholder="Texto del botón, ej: Sitio web"
              />
              <Input
                value={en.url}
                onChange={(e) => actualizarEnlace(i, 'url', e.target.value)}
                maxLength={200}
                aria-label={`Dirección del enlace ${i + 1}`}
                placeholder="https://…"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  aria-label="Subir"
                  disabled={i === 0}
                  onClick={() => moverEnlace(i, -1)}
                >
                  <ArrowUp className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  aria-label="Bajar"
                  disabled={i === enlaces.length - 1}
                  onClick={() => moverEnlace(i, 1)}
                >
                  <ArrowDown className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => setEnlaces((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <X className="size-4" aria-hidden="true" />
                  Quitar
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* ⚠ Las dos advertencias bajan aquí desde el aviso de la pestaña:
            es el campo donde se decide, y arriba se leían una vez y se
            olvidaban antes de llegar a pegar la dirección. */}
        <Alert variant="warning" className="mt-2">
          <TriangleAlert className="size-4" aria-hidden="true" />
          <AlertDescription>
            Antes de guardar, dos cosas: que no sea una página de donaciones de
            un tercero —el plan Hobby de Vercel las cuenta como uso comercial—
            y que enlazarla no sea dar por otra vía algo que el alcance cerrado
            prohíbe: alojamiento, transporte de personas, dinero.
          </AlertDescription>
        </Alert>

        <Button
          type="button"
          variant="outline"
          className="mt-2"
          disabled={enlaces.length >= MAX_ENLACES}
          onClick={() =>
            setEnlaces((prev) =>
              prev.length >= MAX_ENLACES ? prev : [...prev, { etiqueta: '', url: '' }]
            )
          }
        >
          <Plus className="size-5" aria-hidden="true" />
          Otro enlace
        </Button>
        <p className="mt-1 text-base text-muted-foreground">
          Hasta {MAX_ENLACES}. El orden de la lista es el orden de los botones,
          y solo se aceptan direcciones que empiecen por https://.
        </p>
      </div>

      <div>
        <Label htmlFor={`pie-${hojaId}`} className="mb-1">
          Pie (opcional)
        </Label>
        <Textarea
          id={`pie-${hojaId}`}
          value={pie}
          onChange={(e) => setPie(e.target.value)}
          maxLength={400}
          rows={2}
          placeholder="Horarios o aclaraciones"
        />
      </div>

      <div>
        <Label htmlFor={`orden-${hojaId}`} className="mb-1">
          Orden
        </Label>
        <Input
          id={`orden-${hojaId}`}
          type="number"
          inputMode="numeric"
          value={orden}
          onChange={(e) => setOrden(Number(e.target.value) || 0)}
        />
        <p className="mt-1 text-base text-muted-foreground">
          De menor a mayor. Empata por nombre.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={enviando} onClick={cerrar}>
          Cancelar
        </Button>
        <Button disabled={!puedeGuardar} onClick={guardar}>
          {enviando ? 'Guardando…' : entidad ? 'Guardar' : 'Crear entidad'}
        </Button>
      </div>
    </div>
  )
}

/** Publicar o retirar, y borrar con su confirmación. */
function AccionesEntidad({ entidad }: { entidad: EntidadAdmin }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function llamar(fn: 'activar' | 'borrar') {
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } =
      fn === 'activar'
        ? await supabase.rpc('activar_entidad', { p_id: entidad.id, p_activa: !entidad.activa })
        : await supabase.rpc('borrar_entidad', { p_id: entidad.id })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    router.refresh()
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        disabled={enviando}
        onClick={() => llamar('activar')}
      >
        {entidad.activa ? 'Retirar del directorio' : 'Publicar en el directorio'}
      </Button>
      <p className="text-base text-muted-foreground">
        {entidad.activa
          ? 'Retirarla la esconde del directorio sin borrar nada: se puede volver a publicar.'
          : 'Publicarla la devuelve al directorio tal como está escrita.'}
      </p>

      {confirmando ? (
        <>
          <p className="text-base font-medium text-destructive">
            ¿Seguro? Esto borra la entidad para siempre, con su descripción y
            sus enlaces. No se puede deshacer.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={enviando} onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={enviando} onClick={() => llamar('borrar')}>
              {enviando ? 'Borrando…' : 'Sí, borrar'}
            </Button>
          </div>
        </>
      ) : (
        <Button
          variant="destructive"
          className="w-full"
          disabled={enviando}
          onClick={() => setConfirmando(true)}
        >
          Borrar
        </Button>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  )
}

function FilaEntidad({
  entidad,
  municipios,
  posicion,
}: {
  entidad: EntidadAdmin
  municipios: Municipio[]
  posicion: number
}) {
  const hojaEditar = `editar-entidad-${entidad.id}`

  return (
    <li className="rounded-2xl bg-card p-3 shadow-canto">
      <div className="flex items-start gap-3">
        {/* El orden deja de ser un número escrito a ciegas: la fila enseña
            en qué posición queda. */}
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
        >
          {posicion}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-lg leading-tight">{entidad.nombre}</span>
            <span
              className={
                entidad.activa
                  ? 'inline-flex shrink-0 items-center rounded-full border border-ok/30 bg-ok-suave px-2.5 py-0.5 text-sm font-medium text-foreground'
                  : 'inline-flex shrink-0 items-center rounded-full border border-enlace/25 bg-accent px-2.5 py-0.5 text-sm font-medium text-accent-foreground'
              }
            >
              {entidad.activa ? 'Publicada' : 'Retirada'}
            </span>
          </div>
          <p className="mt-0.5 text-base text-muted-foreground">
            {entidad.cobertura === 'nacional'
              ? 'Nacional'
              : `Local · ${entidad.municipios.length} ${
                  entidad.municipios.length === 1 ? 'municipio' : 'municipios'
                }`}
            {' · '}
            {entidad.enlaces.length === 0
              ? 'sin enlaces'
              : `${entidad.enlaces.length} ${entidad.enlaces.length === 1 ? 'enlace' : 'enlaces'}`}
          </p>
        </div>

        <HojaGestion
          id={`gestion-entidad-${entidad.id}`}
          titulo={entidad.nombre}
          resumen={entidad.activa ? 'Publicada en el directorio' : 'Retirada del directorio'}
          papeles={
            // Abre la hoja del formulario. Como es hermana y no
            // descendiente, el navegador cierra esta al abrir aquella.
            <Button variant="outline" className="w-full" popoverTarget={hojaEditar}>
              Editar
            </Button>
          }
          destructivo={<AccionesEntidad entidad={entidad} />}
        />
      </div>

      <HojaAccion id={hojaEditar} titulo="Editar entidad" disparador={() => null}>
        <FormularioEntidad entidad={entidad} municipios={municipios} hojaId={hojaEditar} />
      </HojaAccion>
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
  const nacionales = entidades.filter((e) => e.cobertura === 'nacional').length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base text-muted-foreground">
          <span className="font-semibold text-foreground">
            {entidades.length} {entidades.length === 1 ? 'entidad' : 'entidades'}
          </span>
          {nacionales > 0 && ` · ${nacionales} nacionales`}
        </p>
        <HojaAccion
          id="nueva-entidad"
          titulo="Nueva entidad"
          disparador={(props) => (
            <Button {...props} className="shrink-0">
              <Plus className="size-4" aria-hidden="true" />
              Nueva
            </Button>
          )}
        >
          <FormularioEntidad entidad={null} municipios={municipios} hojaId="nueva-entidad" />
        </HojaAccion>
      </div>

      {entidades.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-base text-muted-foreground">
          No hay entidades en el directorio.
        </p>
      ) : (
        <ul className="space-y-2">
          {entidades.map((e, i) => (
            <FilaEntidad key={e.id} entidad={e} municipios={municipios} posicion={i + 1} />
          ))}
        </ul>
      )}
    </div>
  )
}
