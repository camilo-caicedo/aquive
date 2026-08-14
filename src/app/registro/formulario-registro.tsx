'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RESPONSABLE, ENTIDADES_MATRICULA } from '@/lib/config'
import type { Database, TipoPerfil, ContactoTipo, EntidadMatricula } from '@/lib/types'
import type { MunicipioBasico as Municipio } from '@/lib/municipios'
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

const AREAS: Record<Servicio['area'], string> = {
  ingenieria: 'Ingeniería',
  arquitectura: 'Arquitectura',
  psicologia: 'Psicología',
  salud: 'Salud',
  derecho: 'Derecho',
}

export function FormularioRegistro({
  municipios,
  perfil,
  servidor,
  servicios,
}: {
  municipios: Municipio[]
  perfil: Perfil | null
  servidor: Servidor | null
  servicios: Servicio[]
}) {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoPerfil>(perfil?.tipo ?? 'ofertador')
  const [nombre, setNombre] = useState(perfil?.nombre_visible ?? '')
  const [seleccionados, setSeleccionados] = useState<string[]>(perfil?.municipios ?? [])
  const [contacto, setContacto] = useState(perfil?.contacto_publico ?? '')
  const [contactoTipo, setContactoTipo] = useState<ContactoTipo>(
    perfil?.contacto_tipo ?? 'whatsapp'
  )
  const [descripcion, setDescripcion] = useState(perfil?.descripcion ?? '')
  const [profesion, setProfesion] = useState(servidor?.profesion ?? '')
  const [entidad, setEntidad] = useState<EntidadMatricula>(
    servidor?.entidad_matricula ?? 'COPNIA'
  )
  const [matricula, setMatricula] = useState(servidor?.numero_matricula ?? '')
  const [serviciosIds, setServiciosIds] = useState<string[]>(servidor?.servicios ?? [])
  const [autorizo, setAutorizo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const municipiosElegidos = municipios.filter((m) => seleccionados.includes(m.codigo_dane))
  const serviciosElegidos = servicios.filter((s) => serviciosIds.includes(s.id))

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
    })

    if (rpcError) {
      setError(rpcError.message)
      setGuardando(false)
      return
    }

    router.push(tipo === 'servidor' ? '/servidores' : '/')
    router.refresh()
  }

  return (
    <div className="mt-6 space-y-6">
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
            : 'Eres profesional con matrícula: ingeniería, arquitectura, psicología, salud o derecho.'}
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
          contacto, descripción y, si aplica, profesión y matrícula— con la
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
