'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RESPONSABLE, ENTIDADES_MATRICULA } from '@/lib/config'
import type {
  Database,
  TipoPerfil,
  ContactoTipo,
  EntidadMatricula,
  Categoria,
  ItemCatalogoPublico,
  OfrecimientoResumen,
  OfrecimientoInput,
} from '@/lib/types'
import { LIMITE_MUNICIPIOS, type MunicipioBasico as Municipio } from '@/lib/municipios'
import { categoria as categoriaInfo } from '@/lib/catalogo'
import { validarSugerencia } from '@/lib/validacion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

type Perfil = Database['public']['Tables']['perfiles']['Row']
type Servidor = Database['public']['Tables']['servidores']['Row']
type Servicio = Database['public']['Tables']['catalogo_servicios']['Row']
type ItemCatalogo = ItemCatalogoPublico

const AREAS: Record<Servicio['area'], string> = {
  ingenieria: 'Ingeniería',
  arquitectura: 'Arquitectura',
  psicologia: 'Psicología',
  salud: 'Salud',
  derecho: 'Derecho',
}

// Identidad estable de una fila del inventario: el item_id o el
// sugerencia_id la identifican mientras existan en la base; una sugerencia
// recién escrita todavía no tiene ninguno de los dos, así que usa el nombre.
function claveOfrecimiento(o: OfrecimientoResumen): string {
  return o.item_id ?? o.sugerencia_id ?? `nueva:${o.nombre}`
}

// Lo que espera guardar_ofrecimientos: exactamente una de las tres llaves
// que identifican el ítem, según de dónde haya salido la fila.
function aOfrecimientoInput(o: OfrecimientoResumen): OfrecimientoInput {
  const base = { cantidad: o.cantidad, disponible: o.disponible }
  if (o.item_id) return { ...base, item_id: o.item_id }
  if (o.sugerencia_id) return { ...base, sugerencia_id: o.sugerencia_id }
  return { ...base, sugerencia: o.nombre }
}

// Opción del combobox de insumos: solo lo mínimo para buscar y mostrar. Se
// usa tanto para el catálogo (lo buscable) como para lo ya elegido —
// incluidas las sugerencias, que nunca están en el catálogo.
interface OpcionInsumo {
  id: string
  nombre: string
  categoria: Categoria | null
}

export function FormularioRegistro({
  municipios,
  perfil,
  servidor,
  servicios,
  itemsCatalogo,
  ofrecimientos,
}: {
  municipios: Municipio[]
  perfil: Perfil | null
  servidor: Servidor | null
  servicios: Servicio[]
  itemsCatalogo: ItemCatalogo[]
  ofrecimientos: OfrecimientoResumen[]
}) {
  const router = useRouter()
  // Un aliado llega aquí con `tipo = 'aliado'`, que no es una de las dos
  // opciones de esta pantalla: nadie se declara aliado, eso pasa al unirse
  // a una organización. Se arranca en 'ofertador' para que el formulario
  // funcione, y el aviso de arriba explica qué significa guardarlo.
  const eraAliado = perfil?.tipo === 'aliado'
  const [tipo, setTipo] = useState<TipoPerfil>(
    !perfil || eraAliado ? 'ofertador' : perfil.tipo
  )
  const [nombre, setNombre] = useState(perfil?.nombre_visible ?? '')
  const [seleccionados, setSeleccionados] = useState<string[]>(perfil?.municipios ?? [])
  const [contacto, setContacto] = useState(perfil?.contacto_publico ?? '')
  const [contactoTipo, setContactoTipo] = useState<ContactoTipo>(
    perfil?.contacto_tipo ?? 'whatsapp'
  )
  const [descripcion, setDescripcion] = useState(perfil?.descripcion ?? '')
  const [puedeTrasladarse, setPuedeTrasladarse] = useState(
    perfil?.puede_trasladarse ?? false
  )
  const [profesion, setProfesion] = useState(servidor?.profesion ?? '')
  const [entidad, setEntidad] = useState<EntidadMatricula>(
    servidor?.entidad_matricula ?? 'COPNIA'
  )
  const [matricula, setMatricula] = useState(servidor?.numero_matricula ?? '')
  const [serviciosIds, setServiciosIds] = useState<string[]>(servidor?.servicios ?? [])
  const [inventario, setInventario] = useState<OfrecimientoResumen[]>(ofrecimientos)
  const [busquedaInsumo, setBusquedaInsumo] = useState('')
  const [errorInventario, setErrorInventario] = useState<string | null>(null)
  const [autorizo, setAutorizo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const municipiosElegidos = municipios.filter((m) => seleccionados.includes(m.codigo_dane))
  const serviciosElegidos = servicios.filter((s) => serviciosIds.includes(s.id))

  const poolInsumos: OpcionInsumo[] = itemsCatalogo.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    categoria: i.categoria,
  }))
  const elegidosInsumos: OpcionInsumo[] = inventario.map((o) => ({
    id: claveOfrecimiento(o),
    nombre: o.nombre,
    categoria: o.categoria,
  }))

  function alCambiarInsumos(nuevos: OpcionInsumo[]) {
    const idsNuevos = new Set(nuevos.map((n) => n.id))
    setInventario((prev) => {
      // Conserva cantidad y disponibilidad de lo que ya estaba.
      const conservados = prev.filter((o) => idsNuevos.has(claveOfrecimiento(o)))
      const clavesConservadas = new Set(conservados.map(claveOfrecimiento))
      // Lo nuevo siempre sale del catálogo: las sugerencias se agregan
      // aparte, desde el botón de "no encuentro lo que busco".
      const agregados: OfrecimientoResumen[] = nuevos
        .filter((n) => !clavesConservadas.has(n.id))
        .map((n) => {
          const item = itemsCatalogo.find((i) => i.id === n.id)
          return {
            item_id: n.id,
            sugerencia_id: null,
            nombre: n.nombre,
            categoria: n.categoria,
            unidad: item?.unidad ?? 'unidad',
            cantidad: null,
            disponible: true,
            por_confirmar: false,
          }
        })
      return [...conservados, ...agregados]
    })
  }

  function cambiarCantidadInsumo(clave: string, cantidad: number | null) {
    setInventario((prev) =>
      prev.map((o) => (claveOfrecimiento(o) === clave ? { ...o, cantidad } : o))
    )
  }

  // Máximo 3 sugerencias nuevas por guardado: mismo límite que impone
  // guardar_ofrecimientos, repetido aquí para avisar antes de mandar el POST.
  function agregarSugerencia() {
    const texto = busquedaInsumo.trim()
    // Este texto va directo a la base por RPC, sin pasar por ningún route
    // handler: si no se filtra aquí, el único control es el de Postgres.
    const errorTexto = validarSugerencia(texto)
    if (errorTexto) {
      setErrorInventario(errorTexto)
      return
    }
    if (inventario.some((o) => o.nombre.toLowerCase() === texto.toLowerCase())) {
      setErrorInventario('Ya agregaste eso.')
      return
    }
    const sugerenciasNuevas = inventario.filter((o) => !o.item_id && !o.sugerencia_id).length
    if (sugerenciasNuevas >= 3) {
      setErrorInventario('Puedes sugerir máximo 3 cosas nuevas por guardado.')
      return
    }
    setErrorInventario(null)
    setInventario((prev) => [
      ...prev,
      {
        item_id: null,
        sugerencia_id: null,
        nombre: texto,
        categoria: null,
        unidad: 'unidad',
        cantidad: null,
        disponible: true,
        por_confirmar: true,
      },
    ])
    setBusquedaInsumo('')
  }

  const nombreValido = nombre.trim().length >= 3 && nombre.trim().length <= 60
  const contactoValido = contacto.trim().length >= 7 && contacto.trim().length <= 40
  const servidorValido =
    tipo === 'ofertador' || (profesion.trim().length > 0 && matricula.trim().length > 0)

  const puedeGuardar =
    nombreValido &&
    contactoValido &&
    seleccionados.length > 0 &&
    servidorValido &&
    autorizo &&
    !guardando

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('crear_perfil', {
      p_nombre_visible: nombre.trim(),
      p_tipo: tipo,
      p_municipios: seleccionados,
      p_contacto_publico: contacto.trim(),
      p_contacto_tipo: contactoTipo,
      p_descripcion: descripcion.trim() || null,
      p_profesion: tipo === 'servidor' ? profesion.trim() : null,
      p_entidad_matricula: tipo === 'servidor' ? entidad : null,
      p_numero_matricula: tipo === 'servidor' ? matricula.trim() : null,
      p_servicios: tipo === 'servidor' ? serviciosIds : [],
      p_puede_trasladarse: puedeTrasladarse,
    })

    if (rpcError) {
      setError(rpcError.message)
      setGuardando(false)
      return
    }

    // Va después de crear_perfil porque guardar_ofrecimientos exige que el
    // perfil ya exista. Si esto falla, el perfil de todos modos quedó
    // guardado: solo se pierde el inventario, no el perfil.
    //
    // Para los dos tipos: un profesional con matrícula también puede tener
    // cobijas en la casa, y no había ninguna razón para negárselo. La RPC
    // nunca miró el tipo; el que lo bloqueaba era este `if`.
    const { error: inventarioError } = await supabase.rpc('guardar_ofrecimientos', {
      p_items: inventario.map(aOfrecimientoInput),
    })
    if (inventarioError) {
      setError(inventarioError.message)
      setGuardando(false)
      return
    }

    // Con el parámetro: /servidores abre la pestaña de entidades, y quien
    // acaba de registrarse como servidor espera verse a sí mismo.
    // A los avisos, no al tablero. Es el segundo en que la persona acaba de
    // decir que quiere ayudar, así que es cuando más sentido tiene pedirlos
    // y menos se rechazan. Antes caía en el tablero y los avisos se quedaban
    // en una pestaña que nadie abría: de cinco perfiles en producción, uno
    // solo los tenía activos, y por eso las solicitudes se represaban.
    router.push('/registro?ver=ajustes&nuevo=1')
    router.refresh()
  }

  return (
    <div className="mt-6 space-y-6">
      {eraAliado && (
        <Alert variant="warning">
          <AlertDescription>
            Tu perfil es el de alguien que trabaja en una organización aliada,
            y como tal no se publica en ninguna parte. Si guardas esta
            pantalla, tu perfil pasa a ser también el de quien ofrece ayuda a
            título personal: tu nombre y tu contacto quedan públicos. Seguirás
            en tu organización igual.
          </AlertDescription>
        </Alert>
      )}

      <fieldset>
        <legend className="mb-2 text-base font-medium">¿Qué vas a ofrecer?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant={tipo === 'ofertador' ? 'default' : 'outline'}
            onClick={() => setTipo('ofertador')}
          >
            Insumos
          </Button>
          <Button
            type="button"
            variant={tipo === 'servidor' ? 'default' : 'outline'}
            onClick={() => setTipo('servidor')}
          >
            Servicios profesionales
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {tipo === 'ofertador'
            ? 'Puedes entregar cosas: agua, alimentos, cobijas, aseo.'
            : 'Eres profesional con matrícula: ingeniería, arquitectura, psicología, salud o derecho. Más abajo también puedes contar qué insumos tienes.'}
        </p>
      </fieldset>

      <div>
        <Label htmlFor="nombre" className="mb-1">
          Nombre visible
        </Label>
        <Input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={60}
          placeholder="Ej: Ana Restrepo"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Es público. Puede ser tu nombre o el de tu negocio.
        </p>
      </div>

      {/* Combobox con chips y no una lista de casillas: son 1.100+
          municipios en el país y ninguna lista se puede recorrer a dedo. */}
      <div>
        <Label className="mb-2">¿En qué municipios puedes ayudar?</Label>
        <Combobox
          multiple
          items={municipios}
          limit={LIMITE_MUNICIPIOS}
          value={municipiosElegidos}
          onValueChange={(ms: Municipio[]) =>
            setSeleccionados(ms.map((m) => m.codigo_dane))
          }
          itemToStringLabel={(m: Municipio) => m.nombre}
          isItemEqualToValue={(a: Municipio, b: Municipio) => a.codigo_dane === b.codigo_dane}
        >
          <ComboboxChips className="min-h-12 py-2">
            {municipiosElegidos.map((m) => (
              <ComboboxChip key={m.codigo_dane} className="h-8 px-2 text-sm">
                {m.nombre}
              </ComboboxChip>
            ))}
            <ComboboxChipsInput
              placeholder={
                municipiosElegidos.length === 0 ? 'Escribe para buscar tu municipio' : ''
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
        <p className="mt-1 text-sm text-muted-foreground">
          Puedes elegir varios. Toca la equis para quitar uno.
        </p>
      </div>

      <div>
        <Label htmlFor="contacto" className="mb-1">
          Cómo te contactan
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={contactoTipo === 'whatsapp' ? 'default' : 'outline'}
            onClick={() => setContactoTipo('whatsapp')}
          >
            WhatsApp
          </Button>
          <Button
            type="button"
            variant={contactoTipo === 'telefono' ? 'default' : 'outline'}
            onClick={() => setContactoTipo('telefono')}
          >
            Llamada
          </Button>
        </div>
        <Input
          id="contacto"
          type="tel"
          inputMode="tel"
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          maxLength={40}
          placeholder="Ej: 3001234567"
          className="mt-2"
        />
        <p className="mt-1 text-base text-muted-foreground">
          Si estás en Colombia, escribe tu celular de diez dígitos.{' '}
          <strong className="font-semibold text-foreground">
            Si estás en otro país, empieza con el signo más y el código de tu
            país
          </strong>{' '}
          —por ejemplo +34 600 123 456 para España—, si no, el mensaje no te
          llega.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Este número será visible para cualquiera en internet.
        </p>
      </div>

      {tipo === 'servidor' && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div>
            <Label htmlFor="profesion" className="mb-1">
              Profesión
            </Label>
            <Input
              id="profesion"
              value={profesion}
              onChange={(e) => setProfesion(e.target.value)}
              maxLength={60}
              placeholder="Ej: Ingeniera civil"
            />
          </div>
          <div>
            <Label htmlFor="entidad" className="mb-1">
              Entidad que expide la matrícula
            </Label>
            <Select
              value={entidad}
              onValueChange={(v) => setEntidad((v ?? 'COPNIA') as EntidadMatricula)}
            >
              <SelectTrigger id="entidad">
                <SelectValue>
                  {(v: string) =>
                    ENTIDADES_MATRICULA.find((e) => e.valor === v)?.etiqueta ?? ''
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ENTIDADES_MATRICULA.map((e) => (
                  <SelectItem key={e.valor} value={e.valor}>
                    {e.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="matricula" className="mb-1">
              Número de matrícula
            </Label>
            <Input
              id="matricula"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              maxLength={40}
            />
            <p className="mt-1 text-sm text-muted-foreground">
              Una persona revisa cada matrícula a mano. Mientras tanto tu
              perfil aparece marcado como sin verificar.
            </p>
          </div>

          <div>
            <Label className="mb-2">¿Qué servicios ofreces?</Label>
            <Combobox
              multiple
              items={servicios}
              value={serviciosElegidos}
              onValueChange={(ss: Servicio[]) => setServiciosIds(ss.map((s) => s.id))}
              itemToStringLabel={(s: Servicio) => s.nombre}
              isItemEqualToValue={(a: Servicio, b: Servicio) => a.id === b.id}
            >
              <ComboboxChips className="min-h-12 py-2">
                {serviciosElegidos.map((s) => (
                  <ComboboxChip key={s.id} className="h-8 px-2 text-sm">
                    {s.nombre}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  placeholder={
                    serviciosElegidos.length === 0 ? 'Escribe para buscar un servicio' : ''
                  }
                  className="min-h-8 text-base"
                />
              </ComboboxChips>
              <ComboboxContent>
                <ComboboxEmpty>No encontramos ese servicio.</ComboboxEmpty>
                <ComboboxList>
                  {(s: Servicio) => (
                    <ComboboxItem key={s.id} value={s}>
                      <span className="flex min-w-0 flex-col">
                        <span>{s.nombre}</span>
                        <span className="text-sm text-muted-foreground">{AREAS[s.area]}</span>
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <p className="mt-1 text-sm text-muted-foreground">
              No ofrecemos rescate, búsqueda de personas ni atención de
              urgencias: eso es de bomberos, Defensa Civil y la línea 123.
            </p>
          </div>
        </div>
      )}

      {/* Para los dos tipos: alguien con matrícula también puede tener
          cobijas en la casa, y negárselo no protegía nada. Va después del
          bloque de matrícula para que un profesional lea primero su
          profesión y después qué insumos tiene. */}
      <div className="space-y-2 rounded-lg border border-border p-4">
        <Label className="mb-1">Qué tengo para dar (opcional)</Label>
        <p className="text-sm text-muted-foreground">
          {tipo === 'servidor'
            ? 'Además de tus servicios profesionales, cuéntanos si tienes insumos para entregar: agua, alimentos, cobijas, aseo. '
            : ''}
          Si nos cuentas qué tienes, te avisamos cuando alguien cerca lo
          necesite. Puedes llenarlo después. Sin esto no apareces en las
          coincidencias ni recibes avisos, pero igual puedes navegar y
          responder solicitudes.
        </p>

        <Combobox
          multiple
          items={poolInsumos}
          value={elegidosInsumos}
          onValueChange={alCambiarInsumos}
          itemToStringLabel={(o: OpcionInsumo) => o.nombre}
          isItemEqualToValue={(a: OpcionInsumo, b: OpcionInsumo) => a.id === b.id}
          inputValue={busquedaInsumo}
          onInputValueChange={setBusquedaInsumo}
        >
          <ComboboxChips className="min-h-12 py-2">
            {inventario.map((o) => (
              <ComboboxChip key={claveOfrecimiento(o)} className="h-8 px-2 text-sm">
                {o.nombre}
              </ComboboxChip>
            ))}
            <ComboboxChipsInput
              placeholder={inventario.length === 0 ? 'Escribe para buscar lo que tienes' : ''}
              className="min-h-8 text-base"
            />
          </ComboboxChips>
          <ComboboxContent>
            <ComboboxEmpty>
              <div className="flex flex-col items-center gap-2 py-1">
                <span>No encontramos eso en la lista.</span>
                {busquedaInsumo.trim().length >= 2 && (
                  <Button type="button" variant="outline" onClick={agregarSugerencia}>
                    Agregar &ldquo;{busquedaInsumo.trim()}&rdquo; como sugerencia
                  </Button>
                )}
              </div>
            </ComboboxEmpty>
            <ComboboxList>
              {(o: OpcionInsumo) => (
                <ComboboxItem key={o.id} value={o}>
                  <span className="flex min-w-0 flex-col">
                    <span>{o.nombre}</span>
                    <span className="text-sm text-muted-foreground">
                      {o.categoria ? categoriaInfo(o.categoria).etiqueta : ''}
                    </span>
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {errorInventario && <p className="text-sm text-destructive">{errorInventario}</p>}

        {inventario.length > 0 && (
          <ul className="space-y-2 pt-1">
            {inventario.map((o) => (
              <li
                key={claveOfrecimiento(o)}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base">
                    {o.nombre}
                    {o.por_confirmar && (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        · por confirmar
                      </span>
                    )}
                  </p>
                  {o.categoria && (
                    <p className="text-sm text-muted-foreground">
                      {categoriaInfo(o.categoria).etiqueta}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-12"
                    aria-label={`Restar cantidad de ${o.nombre}`}
                    onClick={() =>
                      cambiarCantidadInsumo(
                        claveOfrecimiento(o),
                        o.cantidad === null || o.cantidad <= 1 ? null : o.cantidad - 1
                      )
                    }
                  >
                    −
                  </Button>
                  <span className="w-8 text-center text-base tabular-nums">
                    {o.cantidad ?? '—'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-12"
                    aria-label={`Sumar cantidad de ${o.nombre}`}
                    onClick={() => cambiarCantidadInsumo(claveOfrecimiento(o), (o.cantidad ?? 0) + 1)}
                  >
                    +
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          La cantidad es solo un cálculo aproximado, no hace falta que sea
          exacta.
        </p>
      </div>

      <div>
        <Label htmlFor="descripcion" className="mb-1">
          Descripción (opcional)
        </Label>
        <Textarea
          id="descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Qué puedes ofrecer y en qué horarios"
        />
        <p className="mt-1 text-sm text-muted-foreground">{descripcion.length}/300</p>
      </div>

      {/* Se pregunta una vez aquí y después viene marcada al responder, que
          es el punto: la logística era lo que más se repetía en el chat. Se
          puede desmarcar en una respuesta concreta — se puede tener carro y
          no poder ese día. */}
      <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-accent">
        <input
          type="checkbox"
          checked={puedeTrasladarse}
          onChange={(e) => setPuedeTrasladarse(e.target.checked)}
          className="mt-0.5 size-6 shrink-0"
        />
        <span>
          <span className="text-base font-medium">Puedo trasladarme a entregar</span>
          <span className="block text-sm text-muted-foreground">
            Puedes llevar las cosas hasta donde haga falta. Aparece en tu ficha
            y viene marcado cuando respondas.
          </span>
        </span>
      </label>

      {/* Texto exacto de docs/legal/PLANTILLAS.md sección 3. La marca de
          tiempo que lo acompaña es la prueba de la autorización. */}
      <label className="flex cursor-pointer gap-3 rounded-lg border-2 border-border bg-muted/40 p-4 has-checked:border-primary">
        <input
          type="checkbox"
          checked={autorizo}
          onChange={(e) => setAutorizo(e.target.checked)}
          className="mt-1 size-6 shrink-0"
        />
        <span className="text-base">
          Autorizo a {RESPONSABLE}, responsable de esta plataforma, a tratar
          los datos que estoy entregando —nombre visible, municipios, forma de
          contacto, descripción, los insumos que diga tener y, si aplica,
          profesión y matrícula— con la
          finalidad de publicarlos de forma <strong>pública</strong> en esta
          plataforma para que personas afectadas puedan contactarme. Entiendo
          que esta información será visible para cualquiera en internet, que
          puedo borrarla en cualquier momento, y he leído el{' '}
          <a href="/privacidad" className="underline">
            aviso de privacidad
          </a>
          .
        </span>
      </label>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button className="w-full" disabled={!puedeGuardar} onClick={guardar}>
        {guardando ? 'Guardando…' : 'Guardar perfil'}
      </Button>
    </div>
  )
}
