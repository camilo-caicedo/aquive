'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { enlaceInvitacion, proponerSlug } from '@/lib/organizaciones'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { InvitacionResumen, OrganizacionAdmin, TipoOrganizacion } from '@/lib/types'
import { LIMITE_MUNICIPIOS, mapaDeNombres, nombreConDepartamento, type MunicipioBasico as Municipio } from '@/lib/municipios'

const TIPOS: { valor: TipoOrganizacion; etiqueta: string }[] = [
  { valor: 'fundacion', etiqueta: 'Fundación' },
  { valor: 'corporacion', etiqueta: 'Corporación' },
  { valor: 'entidad_publica', etiqueta: 'Entidad pública' },
  { valor: 'junta', etiqueta: 'Junta de acción comunal' },
  { valor: 'otra', etiqueta: 'Otra' },
]

function FormularioOrganizacion({
  organizacion,
  municipios,
  onCancelar,
  onGuardado,
}: {
  organizacion: OrganizacionAdmin | null
  municipios: Municipio[]
  onCancelar: () => void
  onGuardado: () => void
}) {
  const router = useRouter()
  const [nombre, setNombre] = useState(organizacion?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoOrganizacion>(organizacion?.tipo ?? 'fundacion')
  const [nit, setNit] = useState(organizacion?.nit ?? '')
  const [slug, setSlug] = useState(organizacion?.slug ?? '')
  // Una vez que el slug existe, cambiarlo rompe los carteles ya pegados.
  // Por eso solo se propone solo mientras nadie lo haya tocado y la
  // organización sea nueva.
  const [slugTocado, setSlugTocado] = useState(organizacion !== null)
  const [municipiosSel, setMunicipiosSel] = useState<string[]>(organizacion?.municipios ?? [])
  const [direccion, setDireccion] = useState(organizacion?.direccion_acopio ?? '')
  const [horario, setHorario] = useState(organizacion?.horario_acopio ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const municipiosElegidos = municipios.filter((m) => municipiosSel.includes(m.codigo_dane))

  function cambiarNombre(valor: string) {
    setNombre(valor)
    if (!slugTocado) setSlug(proponerSlug(valor))
  }

  const nombreValido = nombre.trim().length >= 3 && nombre.trim().length <= 80
  const nitValido = /^[0-9]{5,15}(-[0-9])?$/.test(nit.trim())
  const slugValido = /^[a-z0-9-]{3,40}$/.test(slug.trim())
  const puedeGuardar =
    nombreValido && nitValido && slugValido && municipiosSel.length > 0 && !enviando

  async function guardar() {
    if (!puedeGuardar) return
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('guardar_organizacion', {
      p_id: organizacion?.id ?? null,
      p_nombre: nombre.trim(),
      p_nit: nit.trim(),
      p_slug: slug.trim(),
      p_municipios: municipiosSel,
      p_tipo: tipo,
      p_direccion_acopio: direccion.trim() || null,
      p_horario_acopio: horario.trim() || null,
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
        <Label htmlFor="org-nombre" className="mb-1">
          Nombre
        </Label>
        <Input
          id="org-nombre"
          value={nombre}
          onChange={(e) => cambiarNombre(e.target.value)}
          maxLength={80}
          placeholder="Ej: Fundación Manos de Cali"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-base font-medium">Tipo</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TIPOS.map((t) => (
            <Button
              key={t.valor}
              type="button"
              variant={tipo === t.valor ? 'default' : 'outline'}
              onClick={() => setTipo(t.valor)}
            >
              {t.etiqueta}
            </Button>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="org-nit" className="mb-1">
          NIT
        </Label>
        <Input
          id="org-nit"
          value={nit}
          onChange={(e) => setNit(e.target.value)}
          inputMode="numeric"
          maxLength={20}
          placeholder="900123456-7"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Cópialo del certificado del RUES. Míralo antes de crear la
          organización: aquí no hay cola de verificación porque la
          verificación eres tú.
        </p>
      </div>

      <div>
        <Label htmlFor="org-slug" className="mb-1">
          Dirección corta
        </Label>
        <Input
          id="org-slug"
          value={slug}
          onChange={(e) => {
            setSlugTocado(true)
            setSlug(e.target.value.toLowerCase())
          }}
          maxLength={40}
          placeholder="fundacion-manos-cali"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Va en el enlace para unirse: /unirse/{slug || 'nombre-corto'}.
          Identifica a la organización, no autoriza a nadie: quien llega sin
          código queda en la cola de aprobación.
        </p>
        {!slugValido && slug.length > 0 && (
          <p className="mt-1 text-sm text-destructive">
            Minúsculas, números y guiones, de 3 a 40 caracteres.
          </p>
        )}
      </div>

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
      </div>

      <div>
        <Label htmlFor="org-direccion" className="mb-1">
          Dirección del acopio (opcional)
        </Label>
        <Input
          id="org-direccion"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          maxLength={200}
          placeholder="Calle 5 #38-25, bodega 2"
        />
      </div>

      <div>
        <Label htmlFor="org-horario" className="mb-1">
          Horario del acopio (opcional)
        </Label>
        <Input
          id="org-horario"
          value={horario}
          onChange={(e) => setHorario(e.target.value)}
          maxLength={200}
          placeholder="Lunes a sábado, 8 a. m. a 5 p. m."
        />
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

function Invitacion({
  invitacion,
  slug,
  origen,
  onCambio,
}: {
  invitacion: InvitacionResumen
  slug: string
  origen: string
  onCambio: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const enlace = enlaceInvitacion(origen, slug, invitacion.codigo)

  async function copiar() {
    await navigator.clipboard.writeText(enlace)
    setCopiado(true)
  }

  async function desactivar() {
    setEnviando(true)
    const supabase = createClient()
    await supabase.rpc('desactivar_invitacion', { p_id: invitacion.id })
    onCambio()
  }

  return (
    <li className="rounded-lg border border-border p-3">
      <p className="text-base font-medium">
        {invitacion.rol_otorgado === 'coordinador' ? 'Coordinador' : 'Miembro'} ·{' '}
        {invitacion.usos}/{invitacion.usos_max} usos
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Vence el{' '}
        {new Date(invitacion.expira_at).toLocaleString('es-CO', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      <p className="mt-2 font-mono text-sm break-all text-muted-foreground">{enlace}</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button variant="outline" onClick={copiar}>
          {copiado ? 'Copiado' : 'Copiar enlace'}
        </Button>
        <Button variant="destructive" disabled={enviando} onClick={desactivar}>
          {enviando ? 'Anulando…' : 'Anular'}
        </Button>
      </div>
    </li>
  )
}

function FichaOrganizacion({
  organizacion,
  nombreMunicipio,
  origen,
  onEditar,
}: {
  organizacion: OrganizacionAdmin
  nombreMunicipio: (codigo: string) => string
  origen: string
  onEditar: () => void
}) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function llamar(fn: () => Promise<{ error: { message: string } | null }>) {
    setEnviando(true)
    setError(null)
    const { error: rpcError } = await fn()
    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }
    setEnviando(false)
    router.refresh()
  }

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-bold">{organizacion.nombre}</span>
        <span
          className={
            organizacion.activa
              ? 'inline-flex shrink-0 items-center rounded-full border border-ok/30 bg-ok-suave px-2.5 py-0.5 text-base font-medium text-ok'
              : 'inline-flex shrink-0 items-center rounded-full border border-primary/25 bg-accent px-2.5 py-0.5 text-base font-medium text-accent-foreground'
          }
        >
          {organizacion.activa ? 'Activa' : 'Suspendida'}
        </span>
      </div>

      <p className="mt-1 font-mono text-base">/unirse/{organizacion.slug}</p>
      <p className="mt-1 text-base text-muted-foreground">
        NIT {organizacion.nit} ·{' '}
        {organizacion.municipios.map(nombreMunicipio).join(', ')}
      </p>
      <p className="mt-1 text-base text-muted-foreground">
        {organizacion.coordinadores}{' '}
        {organizacion.coordinadores === 1 ? 'coordinador' : 'coordinadores'} ·{' '}
        {organizacion.miembros} en el equipo
        {organizacion.pendientes > 0 && ` · ${organizacion.pendientes} por aprobar`}
      </p>

      {/* La organización nace sin nadie dentro. Mientras no haya un
          coordinador, esa fundación no puede hacer absolutamente nada, y
          quien tiene que darse cuenta de eso es quien la acaba de crear. */}
      {organizacion.coordinadores === 0 && (
        <Alert variant="warning" className="mt-3">
          <AlertDescription>
            Todavía no tiene coordinador. Genera la invitación y pásale el
            enlace a la persona de contacto de la organización.
          </AlertDescription>
        </Alert>
      )}

      {organizacion.invitaciones.length > 0 && (
        <ul className="mt-3 space-y-2">
          {organizacion.invitaciones.map((i) => (
            <Invitacion
              key={i.id}
              invitacion={i}
              slug={organizacion.slug}
              origen={origen}
              onCambio={() => router.refresh()}
            />
          ))}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button variant="outline" disabled={enviando} onClick={onEditar}>
          Editar
        </Button>
        <Button
          variant="outline"
          disabled={enviando || !organizacion.activa}
          onClick={() =>
            llamar(async () => {
              const supabase = createClient()
              return supabase.rpc('crear_invitacion', {
                p_organizacion_id: organizacion.id,
                p_rol: 'coordinador',
                p_horas: 168,
                p_usos_max: 1,
              })
            })
          }
        >
          Invitar coordinador
        </Button>
        <Button
          variant={organizacion.activa ? 'destructive' : 'outline'}
          disabled={enviando}
          onClick={() =>
            llamar(async () => {
              const supabase = createClient()
              return supabase.rpc('activar_organizacion', {
                p_id: organizacion.id,
                p_activa: !organizacion.activa,
              })
            })
          }
        >
          {organizacion.activa ? 'Suspender' : 'Reactivar'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </li>
  )
}

export function PanelOrganizaciones({
  organizaciones,
  municipios,
  origen,
}: {
  organizaciones: OrganizacionAdmin[]
  municipios: Municipio[]
  /** Calculado en el servidor: un cliente no puede sin romper la hidratación. */
  origen: string
}) {
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const nombrePorCodigo = mapaDeNombres(municipios)
  const nombreMunicipio = (codigo: string) => nombrePorCodigo.get(codigo) ?? codigo

  return (
    <div className="mt-3 space-y-3">
      {creando ? (
        <FormularioOrganizacion
          organizacion={null}
          municipios={municipios}
          onCancelar={() => setCreando(false)}
          onGuardado={() => setCreando(false)}
        />
      ) : (
        editandoId === null && (
          <Button variant="outline" onClick={() => setCreando(true)}>
            + Nueva organización
          </Button>
        )
      )}

      {organizaciones.length === 0 && !creando ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-base text-muted-foreground">
          No hay organizaciones aliadas.
        </p>
      ) : (
        <ul className="space-y-3">
          {organizaciones.map((o) =>
            editandoId === o.id ? (
              <li key={o.id}>
                <FormularioOrganizacion
                  organizacion={o}
                  municipios={municipios}
                  onCancelar={() => setEditandoId(null)}
                  onGuardado={() => setEditandoId(null)}
                />
              </li>
            ) : (
              <FichaOrganizacion
                key={o.id}
                organizacion={o}
                nombreMunicipio={nombreMunicipio}
                origen={origen}
                onEditar={() => setEditandoId(o.id)}
              />
            )
          )}
        </ul>
      )}
    </div>
  )
}
