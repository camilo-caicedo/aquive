'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  RESPONSABLE_SERVICIOS,
  NIT_RESPONSABLE_SERVICIOS,
  AUTORIZACION_PROVEEDOR_VERSION,
} from '@/lib/config'
import { contienePII, MENSAJE_PII } from '@/lib/validacion'
import { nombreConDepartamento, type MunicipioBasico } from '@/lib/municipios'
import {
  DIAS,
  FRANJAS,
  GRUPOS,
  MEDIOS_PAGO,
  MODALIDADES,
  MODOS_PRECIO,
  TIPOS_PROVEEDOR,
  TOPE_OFICIOS,
  UNIDADES,
} from '@/lib/servicios'
import type {
  Database,
  DiaSemana,
  FranjaHoraria,
  MedioPago,
  MiProveedor,
  ModalidadServicio,
  ModoPrecio,
  OficioProveedorInput,
  TipoProveedor,
  UnidadPrecio,
} from '@/lib/types'
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
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from '@/components/ui/combobox'

type Oficio = Database['public']['Tables']['catalogo_oficios']['Row']
type Zona = Database['public']['Tables']['zonas']['Row']

/** Píldora que se enciende y se apaga. 48 px de alto, como todo lo demás. */
function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`inline-flex min-h-12 items-center rounded-full border px-4 text-base transition-colors ${
        activo
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}

function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]
}

export function FormularioProveedor({
  proveedor,
  municipios,
  oficios,
  zonas,
  token,
}: {
  proveedor: MiProveedor | null
  municipios: MunicipioBasico[]
  oficios: Oficio[]
  zonas: Zona[]
  /**
   * Solo para quien no tiene cuenta y llegó por su enlace. Va en el
   * cuerpo de la llamada, nunca en una query string (regla 6). Con él
   * puede editar y borrar su ficha sin pasar por la organización que lo
   * registró: es su puerta de habeas data, no un atajo.
   */
  token?: string
}) {
  const router = useRouter()

  const [nombre, setNombre] = useState(proveedor?.nombre_visible ?? '')
  const [tipo, setTipo] = useState<TipoProveedor>(proveedor?.tipo ?? 'persona')
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? '')
  const [municipio, setMunicipio] = useState(proveedor?.municipio ?? '')
  const [zonaId, setZonaId] = useState(proveedor?.zona_id ?? '')
  const [zonaTexto, setZonaTexto] = useState(proveedor?.zona_texto ?? '')
  const [modalidad, setModalidad] = useState<ModalidadServicio[]>(
    proveedor?.modalidad ?? []
  )
  const [dias, setDias] = useState<DiaSemana[]>(proveedor?.dias ?? [])
  const [franjas, setFranjas] = useState<FranjaHoraria[]>(proveedor?.franjas ?? [])
  const [mediosPago, setMediosPago] = useState<MedioPago[]>(proveedor?.medios_pago ?? [])
  const [descripcion, setDescripcion] = useState(proveedor?.descripcion ?? '')
  const [elegidos, setElegidos] = useState<OficioProveedorInput[]>(
    proveedor?.oficios.map((o) => ({
      oficio_id: o.oficio_id,
      modo: o.modo,
      precio_desde: o.precio_desde,
      unidad: o.unidad,
    })) ?? []
  )
  const [autorizo, setAutorizo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const zonasDelMunicipio = zonas.filter((z) => z.municipio === municipio)
  const nombreOficio = new Map(oficios.map((o) => [o.id, o]))

  // El teléfono que la persona está escribiendo NO pasa por contienePII:
  // es un teléfono, y esa es su razón de ser. Lo que sí se filtra es todo
  // lo demás, que es por donde se colaría un segundo número.
  const errorDescripcion = descripcion.trim() && contienePII(descripcion) ? MENSAJE_PII : null
  const errorZona = zonaTexto.trim() && contienePII(zonaTexto) ? MENSAJE_PII : null

  const nombreValido = nombre.trim().length >= 3 && nombre.trim().length <= 60
  const telefonoValido = /^[0-9+()\- ]{7,20}$/.test(telefono.trim())

  const puedeGuardar =
    nombreValido &&
    telefonoValido &&
    municipio !== '' &&
    modalidad.length > 0 &&
    elegidos.length > 0 &&
    !errorDescripcion &&
    !errorZona &&
    descripcion.length <= 300 &&
    autorizo &&
    !guardando

  function alternarOficio(id: string) {
    setElegidos((prev) => {
      if (prev.some((o) => o.oficio_id === id)) {
        return prev.filter((o) => o.oficio_id !== id)
      }
      if (prev.length >= TOPE_OFICIOS) return prev
      return [...prev, { oficio_id: id, modo: 'normal', precio_desde: null, unidad: null }]
    })
  }

  function cambiarOficio(id: string, cambio: Partial<OficioProveedorInput>) {
    setElegidos((prev) =>
      prev.map((o) => (o.oficio_id === id ? { ...o, ...cambio } : o))
    )
  }

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('guardar_proveedor', {
      p_nombre_visible: nombre.trim(),
      p_tipo: tipo,
      p_telefono: telefono.trim(),
      p_municipio: municipio,
      // Una de las dos, nunca las dos: si el municipio tiene zonas
      // sembradas se usa la lista y se descarta lo escrito.
      p_zona_id: zonasDelMunicipio.length > 0 ? zonaId || null : null,
      p_zona_texto: zonasDelMunicipio.length > 0 ? null : zonaTexto.trim() || null,
      p_modalidad: modalidad,
      p_dias: dias,
      p_franjas: franjas,
      p_medios_pago: mediosPago,
      p_descripcion: descripcion.trim() || null,
      p_oficios: elegidos,
      p_acepto_publicacion: true,
      p_autorizacion_version: AUTORIZACION_PROVEEDOR_VERSION,
      p_token: token ?? null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setGuardando(false)
      return
    }

    router.push(token ? `/servicios/mi-perfil/${token}` : '/servicios/soy-proveedor?guardado=1')
    router.refresh()
  }

  async function borrar() {
    if (!confirm('¿Seguro? Se borra tu ficha y las calificaciones que hayas recibido. Esto no se puede deshacer.')) {
      return
    }
    setGuardando(true)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('borrar_proveedor', {
      p_token: token ?? null,
    })
    if (rpcError) {
      setError(rpcError.message)
      setGuardando(false)
      return
    }
    router.push('/servicios')
    router.refresh()
  }

  const municipioElegido = municipios.find((m) => m.codigo_dane === municipio)

  return (
    <div className="mt-6 space-y-6">
      {proveedor?.suspendido && (
        <Alert variant="warning">
          <AlertDescription>
            Tu ficha está suspendida y no aparece en el directorio. Escríbenos
            si crees que fue un error.
          </AlertDescription>
        </Alert>
      )}

      {/* Explica por qué un oficio elegido no se ve todavía. Sin esto, la
          regla S parece que la ficha está rota. */}
      {proveedor?.oficios.some((o) => !o.publicado) && (
        <Alert variant="warning">
          <AlertDescription>
            Algunos de tus oficios —
            {proveedor.oficios
              .filter((o) => !o.publicado)
              .map((o) => o.nombre)
              .join(', ')}
            — todavía no aparecen en el directorio. Por el cuidado de personas
            y el transporte de pasajeros pasa a alguien un teléfono
            verificado y una referencia de un cliente anterior. Cuando{' '}
            {RESPONSABLE_SERVICIOS} confirme las dos cosas, aparecen solos.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="nombre">Cómo quieres que te llamen</Label>
        <Input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={60}
          placeholder="María, Taller El Buen Corte…"
          className="mt-1"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-base font-medium">¿Cómo trabajas?</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS_PROVEEDOR.map((t) => (
            <Chip key={t.valor} activo={tipo === t.valor} onClick={() => setTipo(t.valor)}>
              {t.etiqueta}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="telefono">Teléfono donde te contactan</Label>
        <Input
          id="telefono"
          type="tel"
          inputMode="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          maxLength={20}
          placeholder="300 123 4567"
          className="mt-1"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Este número queda público. Si lo cambias, la verificación se cae y
          hay que volver a hacerla.
        </p>
      </div>

      <div>
        <Label>Municipio donde trabajas</Label>
        <Combobox
          items={municipios}
          value={municipioElegido ?? null}
          onValueChange={(m: MunicipioBasico | null) => {
            setMunicipio(m?.codigo_dane ?? '')
            setZonaId('')
          }}
          itemToStringLabel={nombreConDepartamento}
          isItemEqualToValue={(a: MunicipioBasico, b: MunicipioBasico) =>
            a.codigo_dane === b.codigo_dane
          }
        >
          <ComboboxTrigger
            aria-label="Municipio donde trabajas"
            render={
              <Button
                variant="outline"
                className="mt-1 w-full justify-between bg-background px-3 font-normal"
              />
            }
          >
            <ComboboxValue placeholder="Elige tu municipio" />
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxInput showTrigger={false} placeholder="Escribe para buscar" />
            <ComboboxEmpty>No encontramos ese lugar.</ComboboxEmpty>
            <ComboboxList>
              {(m: MunicipioBasico) => (
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

      {municipio !== '' &&
        (zonasDelMunicipio.length > 0 ? (
          <div>
            <Label>Comuna o corregimiento</Label>
            <Select value={zonaId} onValueChange={(v) => setZonaId(v ?? '')}>
              <SelectTrigger aria-label="Comuna o corregimiento" className="mt-1 bg-background">
                <SelectValue placeholder="Toda la ciudad">
                  {(v: string) =>
                    zonasDelMunicipio.find((z) => z.id === v)?.nombre ?? 'Toda la ciudad'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toda la ciudad</SelectItem>
                {zonasDelMunicipio.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div>
            <Label htmlFor="zona">Barrio o zona</Label>
            <Input
              id="zona"
              value={zonaTexto}
              onChange={(e) => setZonaTexto(e.target.value)}
              maxLength={60}
              placeholder="El Poblado, centro…"
              className="mt-1"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              El barrio, no la dirección. Nadie necesita saber tu casa para
              llamarte.
            </p>
            {errorZona && <p className="mt-1 text-sm text-destructive">{errorZona}</p>}
          </div>
        ))}

      <fieldset>
        <legend className="mb-2 text-base font-medium">¿Dónde atiendes?</legend>
        <div className="flex flex-wrap gap-2">
          {MODALIDADES.map((m) => (
            <Chip
              key={m.valor}
              activo={modalidad.includes(m.valor)}
              onClick={() => setModalidad((p) => alternar(p, m.valor))}
            >
              {m.etiqueta}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-base font-medium">
          ¿Qué días? <span className="font-normal text-muted-foreground">(opcional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {DIAS.map((d) => (
            <Chip
              key={d.valor}
              activo={dias.includes(d.valor)}
              onClick={() => setDias((p) => alternar(p, d.valor))}
            >
              <span className="sr-only">{d.etiqueta}</span>
              <span aria-hidden="true">{d.corta}</span>
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {FRANJAS.map((f) => (
            <Chip
              key={f.valor}
              activo={franjas.includes(f.valor)}
              onClick={() => setFranjas((p) => alternar(p, f.valor))}
            >
              {f.etiqueta}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-base font-medium">
          ¿Cómo te pagan?{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {MEDIOS_PAGO.map((m) => (
            <Chip
              key={m.valor}
              activo={mediosPago.includes(m.valor)}
              onClick={() => setMediosPago((p) => alternar(p, m.valor))}
            >
              {m.etiqueta}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          El pago lo arreglas tú con cada persona. AquíVe no recibe dinero ni
          cobra comisión.
        </p>
      </fieldset>

      <fieldset>
        <legend className="text-base font-medium">
          ¿Qué haces? <span className="font-normal text-muted-foreground">(máximo {TOPE_OFICIOS})</span>
        </legend>

        <div className="mt-2 space-y-4">
          {Object.entries(GRUPOS).map(([grupo, etiqueta]) => {
            const delGrupo = oficios.filter((o) => o.grupo === grupo)
            if (delGrupo.length === 0) return null
            return (
              <div key={grupo}>
                <p className="text-sm font-medium text-muted-foreground">{etiqueta}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {delGrupo.map((o) => (
                    <Chip
                      key={o.id}
                      activo={elegidos.some((e) => e.oficio_id === o.id)}
                      onClick={() => alternarOficio(o.id)}
                    >
                      {o.nombre}
                    </Chip>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {elegidos.length > 0 && (
          <ul className="mt-4 space-y-3">
            {elegidos.map((e) => {
              const oficio = nombreOficio.get(e.oficio_id)
              const cobra = e.modo === 'solidario' || e.modo === 'normal'
              return (
                <li key={e.oficio_id} className="rounded-lg border border-border p-3">
                  <p className="text-base font-medium">{oficio?.nombre ?? e.oficio_id}</p>

                  {oficio?.riesgo === 'alto' && (
                    <p className="mt-1 text-sm text-accent-foreground">
                      Para este oficio hace falta que verifiquemos tu teléfono y
                      que confirmes una referencia. Hasta entonces no aparece en
                      el directorio.
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    {MODOS_PRECIO.map((m) => (
                      <Chip
                        key={m.valor}
                        activo={e.modo === m.valor}
                        onClick={() =>
                          cambiarOficio(e.oficio_id, {
                            modo: m.valor as ModoPrecio,
                            // Cambiar a gratis o aporte limpia el precio: si
                            // se dejara puesto, el CHECK de la base rechaza
                            // el guardado con un mensaje que nadie entiende.
                            ...(m.valor === 'gratis' || m.valor === 'aporte'
                              ? { precio_desde: null, unidad: null }
                              : {}),
                          })
                        }
                      >
                        {m.etiqueta}
                      </Chip>
                    ))}
                  </div>

                  {cobra && (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1000}
                        value={e.precio_desde ?? ''}
                        onChange={(ev) =>
                          cambiarOficio(e.oficio_id, {
                            precio_desde:
                              ev.target.value === '' ? null : Number(ev.target.value),
                          })
                        }
                        placeholder="Desde cuánto (opcional)"
                        aria-label={`Precio desde, ${oficio?.nombre ?? ''}`}
                        className="min-w-0 flex-1"
                      />
                      <Select
                        value={e.unidad ?? ''}
                        onValueChange={(v) =>
                          cambiarOficio(e.oficio_id, { unidad: (v || null) as UnidadPrecio | null })
                        }
                      >
                        <SelectTrigger
                          aria-label={`Unidad, ${oficio?.nombre ?? ''}`}
                          className="min-w-0 flex-1 bg-background"
                        >
                          <SelectValue placeholder="¿De qué?">
                            {(v: string) =>
                              UNIDADES.find((u) => u.valor === v)?.etiqueta ?? '¿De qué?'
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map((u) => (
                            <SelectItem key={u.valor} value={u.valor}>
                              {u.etiqueta}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </fieldset>

      <div>
        <Label htmlFor="descripcion">
          Algo más que quieras decir{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Llevo quince años cosiendo. Trabajo rápido y entrego a tiempo."
          className="mt-1"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          {descripcion.length}/300. No pongas otro teléfono ni tu dirección: el
          número de arriba ya sale en tu ficha.
        </p>
        {errorDescripcion && (
          <p className="mt-1 text-sm text-destructive">{errorDescripcion}</p>
        )}
      </div>

      {/* El texto de autorización, entero y sin enlace que haya que abrir.
          Es la prueba del consentimiento informado y se guarda su versión:
          si cambia aquí, se mueve AUTORIZACION_PROVEEDOR_VERSION. */}
      <div className="rounded-lg border border-border p-4">
        <label className="flex items-start gap-3 text-base">
          <input
            type="checkbox"
            checked={autorizo}
            onChange={(e) => setAutorizo(e.target.checked)}
            className="mt-1 size-5 shrink-0"
          />
          <span>
            Autorizo a {RESPONSABLE_SERVICIOS}, NIT {NIT_RESPONSABLE_SERVICIOS},
            responsable del directorio de servicios de AquíVe, a tratar los
            datos que estoy entregando —mi nombre visible, mi teléfono, si soy
            persona o negocio, mis oficios con su precio, mi municipio y zona,
            mis horarios, mis medios de pago y mi descripción— para publicarlos
            de forma <strong>pública</strong> en internet y que quien necesite
            mi trabajo pueda encontrarme.
            <br />
            <br />
            Entiendo que esta información será visible para cualquiera, que{' '}
            <strong>mi ficha no se borra sola</strong> y permanece hasta que yo
            la borre, y que puedo borrarla cuando quiera. He leído el{' '}
            <Link href="/privacidad" className="underline">
              aviso de privacidad
            </Link>
            .
          </span>
        </label>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button className="w-full" onClick={guardar} disabled={!puedeGuardar}>
        {guardando ? 'Guardando…' : proveedor ? 'Guardar cambios' : 'Publicar mi ficha'}
      </Button>

      {proveedor && (
        <Button
          variant="outline"
          className="w-full"
          onClick={borrar}
          disabled={guardando}
        >
          Borrar mi ficha
        </Button>
      )}
    </div>
  )
}
