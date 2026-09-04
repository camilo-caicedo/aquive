'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { MarcoFlujo } from '@/components/marco-flujo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useAviso } from '@/components/avisos'
import { rpc } from '@/orpc/cliente'
import { AUTORIZACION_PERFIL_VERSION, ENTIDADES_MATRICULA, RESPONSABLE } from '@/lib/config'
import { contienePII } from '@/lib/validacion'
import type { Database } from '@/lib/types'

type Servicio = Database['public']['Tables']['catalogo_servicios']['Row']

const AREAS: Record<string, string> = {
  ingenieria: 'Ingeniería',
  arquitectura: 'Arquitectura',
  psicologia: 'Psicología',
  salud: 'Salud',
  derecho: 'Derecho',
}

type MiMatricula = {
  profesion: string
  entidad_matricula: string | null
  numero_matricula: string | null
  servicios: string[]
  verificado: boolean
}

const hoy = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Bogota',
}).format(new Date())

export function FormularioMatricula({
  matricula,
  servicios,
  contactoInicial,
  contactoTipoInicial,
}: {
  matricula: MiMatricula | null
  servicios: Servicio[]
  contactoInicial: string
  contactoTipoInicial: 'whatsapp' | 'telefono'
}) {
  const router = useRouter()
  const avisar = useAviso()

  const [profesion, setProfesion] = useState(matricula?.profesion ?? '')
  const [entidad, setEntidad] = useState(matricula?.entidad_matricula ?? 'COPNIA')
  const [numero, setNumero] = useState(matricula?.numero_matricula ?? '')
  const [elegidos, setElegidos] = useState<string[]>(matricula?.servicios ?? [])
  const [contacto, setContacto] = useState(contactoInicial)
  const [contactoTipo, setContactoTipo] = useState(contactoTipoInicial)
  // Quien ya la declaró la aceptó en su momento: no se le vuelve a pedir la
  // casilla para corregir un número.
  const [autorizo, setAutorizo] = useState(matricula !== null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serviciosElegidos = servicios.filter((s) => elegidos.includes(s.id))

  const errorProfesion =
    profesion.trim().length > 0 && contienePII(profesion)
      ? 'La profesión no puede llevar teléfonos, correos ni cédulas.'
      : null

  const puedeGuardar =
    profesion.trim().length >= 3 &&
    numero.trim().length >= 3 &&
    contacto.trim().length >= 7 &&
    autorizo &&
    !errorProfesion

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await rpc.servicios.guardarMatricula({
        profesion: profesion.trim(),
        entidad_matricula: entidad as 'COPNIA',
        numero_matricula: numero.trim(),
        servicios: elegidos,
        contacto_publico: contacto.trim(),
        contacto_tipo: contactoTipo,
        autorizacion_version: AUTORIZACION_PERFIL_VERSION,
      })
      // La pantalla no lo dice sola —se queda igual—, así que aquí sí toca
      // aviso, y con lo que pasó y no un «Listo» (regla de interfaz 11).
      avisar(
        matricula
          ? 'Guardamos los cambios de tu matrícula.'
          : 'Tu matrícula quedó declarada. Una persona la va a revisar.',
      )
      router.push('/perfil')
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo guardar. Inténtalo otra vez.')
      setGuardando(false)
    }
  }

  return (
    <MarcoFlujo
      titulo="Mi matrícula"
      volver="/perfil"
      sello={matricula && !matricula.verificado ? 'Sin verificar' : undefined}
      accion={
        <Button
          type="button"
          className="w-full"
          disabled={!puedeGuardar || guardando}
          onClick={guardar}
        >
          {guardando ? 'Guardando…' : matricula ? 'Guardar cambios' : 'Declarar mi matrícula'}
        </Button>
      }
    >
      <p className="text-base text-muted-foreground">
        Para ingeniería, arquitectura, psicología, salud y derecho. Con esto
        apareces en el directorio de profesionales, con tu nombre y tu teléfono.
      </p>

      <div className="mt-6 space-y-4 rounded-2xl bg-card p-4 shadow-canto">
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
          {errorProfesion && (
            <p className="mt-1 text-sm font-medium text-destructive">{errorProfesion}</p>
          )}
        </div>

        <div>
          <Label htmlFor="entidad" className="mb-1">
            Entidad que expide la matrícula
          </Label>
          <Select value={entidad} onValueChange={(v) => setEntidad(v ?? 'COPNIA')}>
            <SelectTrigger id="entidad">
              <SelectValue>
                {(v: string) => ENTIDADES_MATRICULA.find((e) => e.valor === v)?.etiqueta ?? ''}
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
          <Label htmlFor="numero" className="mb-1">
            Número de matrícula
          </Label>
          <Input
            id="numero"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            maxLength={40}
          />
          {/* Regla de producto 6: nada nace verificado, y la interfaz tiene
              que decir que la señal es blanda. */}
          <p className="mt-1 text-sm text-muted-foreground">
            Una persona revisa cada matrícula a mano, consultando el registro de
            la entidad. Mientras tanto tu ficha aparece marcada como sin
            verificar, y cualquiera lo ve.
          </p>
        </div>

        <div>
          <Label className="mb-2">¿Qué servicios ofreces?</Label>
          <Combobox
            multiple
            items={servicios}
            value={serviciosElegidos}
            onValueChange={(ss: Servicio[]) => setElegidos(ss.map((s) => s.id))}
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
                      <span className="text-sm text-muted-foreground">
                        {AREAS[s.area] ?? s.area}
                      </span>
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <p className="mt-1 text-sm text-muted-foreground">
            No ofrecemos rescate, búsqueda de personas ni atención de urgencias:
            eso es de bomberos, Defensa Civil y la línea 123.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4 rounded-2xl bg-card p-4 shadow-canto">
        <div>
          <Label htmlFor="contacto" className="mb-1">
            Teléfono por el que te escriben
          </Label>
          <Input
            id="contacto"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            maxLength={40}
            inputMode="tel"
            autoComplete="tel"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Este sí queda público en tu ficha de profesional. Es lo que cambia
            al declarar la matrícula.
          </p>
        </div>
        <div>
          <Label htmlFor="contacto-tipo" className="mb-1">
            ¿Por dónde?
          </Label>
          <Select
            value={contactoTipo}
            onValueChange={(v) => setContactoTipo((v ?? 'whatsapp') as 'whatsapp')}
          >
            <SelectTrigger id="contacto-tipo">
              <SelectValue>
                {(v: string) => (v === 'telefono' ? 'Llamada' : 'WhatsApp')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="telefono">Llamada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* El consentimiento es su propia sección, con su fecha (regla de
          interfaz 6). Aquí sí va, y en el alta de la cuenta no: es aquí donde
          aparece la publicación, y por tanto la finalidad. */}
      {!matricula && (
        <div className="mt-5 rounded-2xl bg-card p-4 shadow-canto">
          <h2 className="font-heading text-xl">Permiso de publicación</h2>
          <label className="mt-3 flex cursor-pointer gap-3 rounded-2xl bg-background p-4 has-checked:bg-accent">
            <input
              type="checkbox"
              checked={autorizo}
              onChange={(e) => setAutorizo(e.target.checked)}
              className="mt-1 size-6 shrink-0"
            />
            <span className="text-base">
              Autorizo a {RESPONSABLE}, responsable de esta plataforma, a tratar
              los datos que estoy entregando —nombre visible, municipios, forma
              de contacto, profesión y matrícula— con la finalidad de publicarlos
              de forma <strong>pública</strong> en esta plataforma para que
              cualquiera pueda contactarme. Entiendo que esta información será
              visible para cualquiera en internet, que puedo borrarla en
              cualquier momento, y he leído el{' '}
              <Link href="/privacidad" className="text-enlace underline">
                aviso de privacidad
              </Link>
              .
            </span>
          </label>
          <p className="mt-2 text-base text-muted-foreground">
            {autorizo
              ? `Fecha de la autorización: ${hoy}.`
              : 'Sin esto no se publica nada.'}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-5 text-base font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </MarcoFlujo>
  )
}
