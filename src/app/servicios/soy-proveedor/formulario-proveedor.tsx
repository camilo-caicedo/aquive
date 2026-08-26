'use client'

import { Check, Eye, EyeOff, Lock, PhoneCall } from 'lucide-react'

import type { ReactNode } from 'react'
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
import { Carne } from '@/components/carne'
import { MarcoFlujo } from '@/components/marco-flujo'
import { AccionPrincipal } from '@/components/accion-principal'
import { SeccionPlegable } from '@/components/seccion-plegable'
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

/**
 * Las piezas del formulario, sueltas.
 *
 * Antes eran cinco plegables encadenados en una sola pantalla. Siguen
 * siendo el mismo estado y la misma llamada a `guardar_proveedor` —esto no
 * partió la lógica de guardado, la parametrizó—, pero ahora cada pantalla
 * de `/perfil` pide las suyas y el resto se guarda sin tocarse.
 */
export type ClaveSeccion =
  | 'quien'
  | 'figura'
  | 'contacto'
  | 'ciudad'
  | 'zonas'
  | 'disponibilidad'
  | 'oficios'
  | 'presentacion'
  | 'permiso'

const TODAS: ClaveSeccion[] = [
  'quien',
  'figura',
  'contacto',
  'ciudad',
  'zonas',
  'disponibilidad',
  'oficios',
  'presentacion',
  'permiso',
]

/**
 * El índice numerado de la pantalla 14, con las tres filas que todavía no
 * se pueden llenar.
 *
 * `claves` vacío significa fila cerrada: no hay nada que escribir ahí
 * hasta que la ficha exista —una referencia cuelga de la ficha, y el
 * teléfono lo verifica una persona después—. Se dibujan igual, con su
 * número y su motivo, porque una lista de diez donde solo aparecen siete
 * hace que quien la mira piense que se le perdió algo.
 */
const FILAS: {
  num: string
  nombre: string
  ayuda: string
  claves: ClaveSeccion[]
  cerrada?: string
}[] = [
  {
    num: '01',
    nombre: 'Quién eres',
    ayuda: 'Cómo quieres que te llamen y el teléfono donde te contactan.',
    claves: ['quien', 'contacto'],
  },
  {
    num: '02',
    nombre: 'Bajo qué figura',
    ayuda: 'Por tu cuenta o con un negocio registrado.',
    claves: ['figura'],
  },
  {
    num: '03',
    nombre: 'Tus oficios',
    ayuda: `Del catálogo, con tu precio desde. Hasta ${TOPE_OFICIOS}.`,
    claves: ['oficios'],
  },
  {
    num: '04',
    nombre: 'Fotos de trabajos',
    ayuda: 'Todavía no se pueden subir fotos a una ficha.',
    claves: [],
    cerrada: 'Cerrado',
  },
  {
    num: '05',
    nombre: 'Días y horas',
    ayuda: 'Los días que trabajas y en qué franja.',
    claves: ['disponibilidad'],
  },
  {
    num: '06',
    nombre: 'Zonas y modalidad',
    ayuda: 'Municipio, comuna o barrio, y si vas a domicilio.',
    claves: ['ciudad', 'zonas'],
  },
  {
    num: '07',
    nombre: 'Referencias',
    ayuda: 'Un cliente anterior al que podamos llamar. Se agrega después de publicar.',
    claves: [],
    cerrada: 'Después',
  },
  {
    num: '08',
    nombre: 'Tu presentación',
    ayuda: 'Lo primero que leen. Máximo 300 caracteres.',
    claves: ['presentacion'],
  },
  {
    num: '09',
    nombre: 'Verificar tu teléfono',
    ayuda: `Alguien de ${RESPONSABLE_SERVICIOS} te llama. No hay SMS automático.`,
    claves: [],
    cerrada: 'Después',
  },
  {
    num: '10',
    nombre: 'Últimos pasos',
    ayuda: 'El permiso de publicación y a publicar.',
    claves: ['permiso'],
  },
]

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
      className={`inline-flex min-h-12 items-center rounded-full px-4 text-base transition-colors ${
        activo
          ? 'bg-primary text-primary-foreground font-semibold'
          : 'shadow-canto bg-card hover:bg-muted'
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
  secciones,
  titulo,
  volver,
  encabezado,
}: {
  proveedor: MiProveedor | null
  municipios: MunicipioBasico[]
  oficios: Oficio[]
  zonas: Zona[]
  /**
   * Solo para quien no tiene cuenta y llegó por su enlace. Va en el
   * cuerpo de la llamada, nunca en una query string (regla 9). Con él
   * puede editar y borrar su ficha sin pasar por la organización que lo
   * registró: es su puerta de habeas data, no un atajo.
   */
  token?: string
  /**
   * Qué secciones dibujar. Sin esto se dibujan todas, que es lo que hacen
   * el alta (`/servicios/soy-proveedor` sin ficha) y la pantalla de quien
   * entra por token. Con esto, cada pantalla de `/perfil` pide la suya.
   *
   * ⚠ Lo que NO cambia es la escritura: `guardar_proveedor` recibe la
   * ficha entera igual, con los valores que ya estaban en las secciones
   * que esta pantalla no enseña. Guardar media ficha borraría la otra
   * media.
   */
  secciones?: ClaveSeccion[]
  /** Título del `MarcoFlujo`, cuando se pide un subconjunto. */
  titulo?: string
  /** A dónde vuelve la flecha. `/perfil` desde las pantallas 17 a 19. */
  volver?: string
  /**
   * Lo que va encima de las secciones: el aviso corto de la pantalla y, en
   * la 17, la lista de qué campo es público. Lo arma el Server Component
   * que ya tiene los datos, así que no hay que traérselos otra vez aquí.
   */
  encabezado?: ReactNode
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
  // ⚠ Con ficha ya publicada nace en `true`, y no es un atajo: la
  // autorización ya se dio y está guardada con su versión y su fecha. La
  // regla 6 dice que el consentimiento bloquea la publicación, no la
  // edición — pedirlo otra vez para corregir un teléfono convierte la
  // casilla en un trámite y le quita el peso que tiene la primera vez.
  const [autorizo, setAutorizo] = useState(!!proveedor)
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

  // Al menos una de las dos. Con las dos, mejor; con ninguna, la ficha no
  // dice dónde atiende y para un servicio a domicilio eso no sirve.
  const hayUbicacion = zonaId !== '' || zonaTexto.trim().length >= 2

  // Lo único que cambia entre Cali y el resto es cómo se llama el campo:
  // donde hay comunas, esto es el barrio; donde no, es la única división
  // que la persona va a saber decir, y puede ser una vereda o un sector.
  const etiquetaZona = zonasDelMunicipio.length > 0 ? 'Barrio' : 'Barrio o vereda'

  const puedeGuardar =
    nombreValido &&
    telefonoValido &&
    municipio !== '' &&
    hayUbicacion &&
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
      // Las dos si las hay. La comuna solo existe donde está sembrada; el
      // texto siempre, y al guardarse se propone como zona del municipio.
      p_zona_id: zonaId || null,
      p_zona_texto: zonaTexto.trim() || null,
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

    if (secciones) {
      router.push(volver ?? '/perfil')
    } else if (token) {
      router.push(`/servicios/mi-perfil/${token}`)
    } else {
      // Recién creada va a la confirmación (pantalla 04), que es donde se
      // dice por qué el carné todavía no lleva sello. Ya creada, vuelve a
      // la ficha publicada.
      router.push(proveedor ? '/servicios/soy-proveedor' : '/servicios/soy-proveedor/listo')
    }
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

  // ─────────────────────────────────────────────────────────────────
  // Las secciones, cada una con su título, su resumen y si le falta algo.
  // Se declaran una vez y las tres formas de esta pantalla —alta, ficha
  // completa por token, y una sección suelta desde /perfil— las reparten.
  // ─────────────────────────────────────────────────────────────────

  const BLOQUES: Record<
    ClaveSeccion,
    { titulo: string; resumen: string; falta: boolean; cuerpo: ReactNode }
  > = {
    quien: {
      titulo: 'Cómo te llamas',
      resumen: nombre.trim() || 'Falta tu nombre',
      falta: !nombreValido,
      cuerpo: (
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
      ),
    },

    figura: {
      titulo: 'Bajo qué figura',
      resumen: TIPOS_PROVEEDOR.find((t) => t.valor === tipo)?.etiqueta ?? '',
      falta: false,
      cuerpo: (
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
      ),
    },

    contacto: {
      titulo: 'Teléfono y pago',
      resumen: telefono.trim() || 'Falta tu teléfono',
      falta: !telefonoValido,
      cuerpo: (
        <>
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
            <p className="mt-2 text-base text-muted-foreground">
              El pago lo arreglas tú con cada persona. AquíVe no recibe dinero ni
              cobra comisión.
            </p>
          </fieldset>
        </>
      ),
    },

    ciudad: {
      titulo: 'Municipio',
      resumen:
        municipio === ''
          ? 'Falta el municipio'
          : municipioElegido
            ? nombreConDepartamento(municipioElegido)
            : municipio,
      falta: municipio === '',
      cuerpo: (
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
              className="mt-1"
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
      ),
    },

    zonas: {
      titulo: 'Zonas y modalidad',
      resumen:
        [zonasDelMunicipio.find((z) => z.id === zonaId)?.nombre, zonaTexto.trim()]
          .filter(Boolean)
          .join(' · ') || 'Falta dónde atiendes',
      falta: !hayUbicacion || modalidad.length === 0,
      cuerpo: (
        <>
          {municipio === '' ? (
            <p className="text-base text-muted-foreground">
              Elige primero tu municipio en «Mis datos y contacto».
            </p>
          ) : (
            <fieldset>
              <legend className="text-base font-medium">¿En qué parte?</legend>

              {/* Las dos, no una u otra: en Cali lo natural es decir la
                  comuna Y el barrio. Con una basta, pero con ninguna no. */}
              {zonasDelMunicipio.length > 0 && (
                <div className="mt-2">
                  <Label>Comuna o corregimiento</Label>
                  <Select value={zonaId} onValueChange={(v) => setZonaId(v ?? '')}>
                    <SelectTrigger aria-label="Comuna o corregimiento" className="mt-1">
                      <SelectValue placeholder="Sin especificar">
                        {(v: string) =>
                          zonasDelMunicipio.find((z) => z.id === v)?.nombre ?? 'Sin especificar'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin especificar</SelectItem>
                      {zonasDelMunicipio.map((z) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="mt-3">
                <Label htmlFor="zona">{etiquetaZona}</Label>
                <Input
                  id="zona"
                  value={zonaTexto}
                  onChange={(e) => setZonaTexto(e.target.value)}
                  maxLength={60}
                  placeholder={
                    zonasDelMunicipio.length > 0 ? 'San Fernando, El Poblado…' : 'Tu barrio o vereda'
                  }
                  className="mt-1"
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  {zonasDelMunicipio.length > 0
                    ? 'El barrio, no la dirección. Nadie necesita saber tu casa para llamarte.'
                    : 'El barrio o la vereda, no la dirección. Lo que escribas lo revisa la fundación y después queda en la lista para los demás de tu municipio.'}
                </p>
                {errorZona && <p className="mt-1 text-sm text-destructive">{errorZona}</p>}
              </div>

              {!hayUbicacion && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Hace falta al menos una de las dos.
                </p>
              )}
            </fieldset>
          )}

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
        </>
      ),
    },

    disponibilidad: {
      titulo: 'Días y horas',
      resumen:
        dias.length === 0
          ? 'Sin días marcados'
          : `${dias.length} ${dias.length === 1 ? 'día' : 'días'}`,
      falta: false,
      cuerpo: (
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
      ),
    },

    oficios: {
      titulo: 'Qué haces y cuánto cobras',
      resumen:
        elegidos.length === 0
          ? 'Sin oficios todavía'
          : `${elegidos.length} ${elegidos.length === 1 ? 'oficio' : 'oficios'}`,
      falta: elegidos.length === 0,
      cuerpo: (
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
                  <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
                    {etiqueta}
                  </p>
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
                // Lo que la ficha publicada dice de este oficio, y por qué
                // (pantalla 18): el estado con su motivo, no solo el estado.
                const publicado = proveedor?.oficios.find(
                  (o) => o.oficio_id === e.oficio_id
                )?.publicado
                return (
                  <li key={e.oficio_id} className="rounded-2xl bg-card p-3 shadow-canto">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-heading text-lg leading-tight">
                        {oficio?.nombre ?? e.oficio_id}
                      </p>
                      {publicado != null && (
                        <span
                          className={`font-heading rounded-full px-3 py-0.5 text-xs tracking-[0.085em] uppercase ${
                            publicado
                              ? 'bg-ok-suave text-foreground'
                              : 'bg-accent text-accent-foreground'
                          }`}
                        >
                          {publicado ? 'Publicado' : 'Escondido'}
                        </span>
                      )}
                    </div>

                    {oficio?.grupo && (
                      <p className="font-heading mt-0.5 text-xs tracking-[0.085em] text-muted-foreground uppercase">
                        {GRUPOS[oficio.grupo]}
                        {oficio.riesgo === 'alto' ? ' · Riesgo alto' : ''}
                      </p>
                    )}

                    {publicado === false ? (
                      <p className="mt-2 rounded-xl bg-accent px-3 py-2 text-base text-accent-foreground">
                        {proveedor?.telefono_verificado
                          ? 'Falta una referencia confirmada para que aparezca en el directorio.'
                          : 'Falta que verifiquemos tu teléfono para que aparezca en el directorio.'}
                      </p>
                    ) : (
                      oficio?.riesgo === 'alto' &&
                      !proveedor && (
                        <p className="mt-2 rounded-xl bg-accent px-3 py-2 text-base text-accent-foreground">
                          Para este oficio hace falta que verifiquemos tu teléfono y
                          que confirmes una referencia. Hasta entonces no aparece en
                          el directorio.
                        </p>
                      )
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
      ),
    },

    presentacion: {
      titulo: 'Tu presentación',
      resumen: descripcion.trim() || 'Sin presentación',
      falta: false,
      cuerpo: (
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
      ),
    },

    permiso: {
      titulo: 'Permiso de publicación',
      resumen: autorizo ? 'Aceptado' : 'Falta tu autorización',
      falta: !autorizo,
      cuerpo: (
        /* El texto de autorización, entero y sin enlace que haya que abrir.
           Es la prueba del consentimiento informado y se guarda su versión:
           si cambia aquí, se mueve AUTORIZACION_PROVEEDOR_VERSION. */
        <div className="rounded-2xl bg-background p-4">
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
              <Link href="/privacidad" className="text-enlace underline">
                aviso de privacidad
              </Link>
              .
            </span>
          </label>
        </div>
      ),
    },
  }

  const avisoError = error && (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )

  // ─────────────────────────────────────────────────────────────────
  // 1 · Una o varias secciones sueltas: las pantallas 17, 18 y 19.
  //     Flujo (regla 9): volver arriba, sin barra inferior, acción abajo.
  // ─────────────────────────────────────────────────────────────────
  if (secciones) {
    return (
      <MarcoFlujo
        titulo={titulo ?? 'Mi ficha'}
        volver={volver ?? '/perfil'}
        accion={
          <Button className="w-full" onClick={guardar} disabled={!puedeGuardar}>
            <Check className="size-5" aria-hidden="true" />
            {guardando ? 'Guardando…' : 'Guardar esta sección'}
          </Button>
        }
      >
        <div className="space-y-4">
          {encabezado}
          {avisoError}
          {secciones.map((clave) => (
            <section key={clave} className="shadow-canto space-y-4 rounded-2xl bg-card p-4">
              <h2 className="font-heading text-xl leading-tight">
                {BLOQUES[clave].titulo}
              </h2>
              {BLOQUES[clave].cuerpo}
            </section>
          ))}

          {!puedeGuardar && !guardando && (
            <p className="text-base text-muted-foreground">
              Para guardar hace falta que el resto de tu ficha esté completa:
              nombre, teléfono, municipio, dónde atiendes y al menos un oficio.
            </p>
          )}
        </div>
      </MarcoFlujo>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // 2 · La ficha entera, para quien entra con su enlace y no tiene
  //     cuenta. Es un destino dentro de su propia pantalla, así que la
  //     acción va en la píldora fija.
  // ─────────────────────────────────────────────────────────────────
  if (proveedor) {
    return (
      <>
        <div className="space-y-3">
          <p className="text-base text-muted-foreground">
            Tu nombre, tu teléfono y lo que haces quedan públicos en internet. Tú
            acuerdas el precio con cada persona: AquíVe no cobra nada.
          </p>

          <Button
            variant="outline"
            className="w-full"
            nativeButton={false}
            render={<Link href={`/prestador/${proveedor.id}`} />}
          >
            <Eye className="size-5" aria-hidden="true" />
            Ver mi ficha como la ven los demás
          </Button>

          {!proveedor.telefono_verificado && !proveedor.suspendido && (
            <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4 text-secondary-foreground">
              <PhoneCall className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
              <p className="text-base">
                <span className="font-semibold">Tu ficha no se ve hasta que te
                llamemos.</span>{' '}
                Alguien de {RESPONSABLE_SERVICIOS} marca tu número y confirma que
                contestas tú. Es lo único que comprobamos, y por eso lo hacemos
                con todas las fichas antes de publicarlas.
              </p>
            </div>
          )}

          {proveedor.suspendido && (
            <Alert variant="warning">
              <AlertDescription>
                Tu ficha está suspendida y no aparece en el directorio. Escríbenos
                si crees que fue un error.
              </AlertDescription>
            </Alert>
          )}

          {proveedor.oficios.some((o) => !o.publicado) && (
            <div className="flex items-start gap-3 rounded-2xl bg-accent p-4 text-accent-foreground">
              <EyeOff className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">
                  {proveedor.oficios.filter((o) => !o.publicado).length === 1
                    ? 'Un oficio no aparece'
                    : `${proveedor.oficios.filter((o) => !o.publicado).length} oficios no aparecen`}
                </p>
                <p className="mt-0.5 text-base">
                  «{proveedor.oficios.filter((o) => !o.publicado)[0].nombre}»
                  {proveedor.telefono_verificado
                    ? ' necesita una referencia confirmada.'
                    : ' necesita que verifiquemos tu teléfono.'}
                </p>
              </div>
            </div>
          )}

          {TODAS.map((clave) => (
            <SeccionPlegable
              key={clave}
              titulo={BLOQUES[clave].titulo}
              resumen={BLOQUES[clave].resumen}
              sello={BLOQUES[clave].falta ? 'Falta' : undefined}
            >
              {BLOQUES[clave].cuerpo}
            </SeccionPlegable>
          ))}

          {avisoError}

          {/* Borrar se queda dentro, al final: no es una acción de esta
              pantalla, es su salida. */}
          <Button variant="outline" className="w-full" onClick={borrar} disabled={guardando}>
            Borrar mi ficha
          </Button>
        </div>

        <AccionPrincipal
          etiqueta={guardando ? 'Guardando…' : 'Guardar'}
          Icono={Check}
          onClick={guardar}
          visible={puedeGuardar || guardando}
        />
      </>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // 3 · El alta. Pantalla 14: índice de diez secciones numeradas, con
  //     su sello de estado, la barra de progreso y el carné en vivo.
  //
  //     Las filas se abren aquí y no saltan a /perfil a propósito:
  //     `guardar_proveedor` escribe la ficha entera de una vez —nombre,
  //     teléfono, municipio, zona y al menos un oficio son NOT NULL—, así
  //     que antes de publicar no hay ficha de la que colgar una pantalla
  //     suelta. Después de publicar sí, y la 15 lleva a cada una.
  // ─────────────────────────────────────────────────────────────────

  const listas = FILAS.filter(
    (f) => f.claves.length > 0 && f.claves.every((c) => !BLOQUES[c].falta)
  ).length
  const porcentaje = Math.round((listas / FILAS.length) * 100)

  return (
    <MarcoFlujo
      titulo="Arma tu carné"
      volver="/inicio"
      accion={
        <Button className="w-full" onClick={guardar} disabled={!puedeGuardar}>
          <Check className="size-5" aria-hidden="true" />
          {guardando ? 'Guardando…' : 'Publicar mi carné'}
        </Button>
      }
    >
      <p className="text-base text-muted-foreground">
        Tu nombre, tu teléfono y lo que haces quedan públicos en internet. Tú
        acuerdas el precio con cada persona: AquíVe no cobra nada.
      </p>

      <div className="mt-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuenow={listas}
          aria-valuemin={0}
          aria-valuemax={FILAS.length}
          aria-label="Secciones listas"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <p className="font-heading mt-1.5 text-xs tracking-[0.085em] text-muted-foreground uppercase">
          {listas} de {FILAS.length} secciones listas
        </p>
      </div>

      {avisoError && <div className="mt-3">{avisoError}</div>}

      <ol className="mt-4 space-y-3">
        {FILAS.map((fila) => {
          const lista =
            fila.claves.length > 0 && fila.claves.every((c) => !BLOQUES[c].falta)
          const sello = fila.cerrada ?? (lista ? 'Listo' : 'Falta')

          if (fila.claves.length === 0) {
            return (
              <li
                key={fila.num}
                className="shadow-canto flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-3"
              >
                <span className="font-mono text-sm text-muted-foreground">{fila.num}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold text-muted-foreground">
                    {fila.nombre}
                  </span>
                  <span className="block text-base text-muted-foreground">{fila.ayuda}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium">
                  <Lock className="size-3.5" aria-hidden="true" />
                  {sello}
                </span>
              </li>
            )
          }

          return (
            <li key={fila.num}>
              <SeccionPlegable
                titulo={`${fila.num} · ${fila.nombre}`}
                resumen={fila.ayuda}
                resumenSiempre
                sello={sello}
              >
                {fila.claves.map((c) => (
                  <div key={c} className="space-y-4">
                    {BLOQUES[c].cuerpo}
                  </div>
                ))}
              </SeccionPlegable>
            </li>
          )
        })}
      </ol>

      {/* La vista previa, en vivo. Es la misma pieza que se publica —el
          carné de la pantalla 15 y de la 04—, así que quien la mira aquí
          ve exactamente lo que va a quedar, sellos incluidos. */}
      <div className="mt-6">
        <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
          Vista previa · lo que verán
        </p>
        <div className="mt-2">
          <Carne
            id="00000000-0000-0000-0000-000000000000"
            nombre={nombre.trim() || 'Tu nombre irá aquí'}
            municipio={municipioElegido ? nombreConDepartamento(municipioElegido) : null}
            grupo={nombreOficio.get(elegidos[0]?.oficio_id ?? '')?.grupo ?? null}
            telefonoVerificado={false}
            esMicroempresa={tipo === 'microempresa'}
          />
        </div>
        <p className="mt-2 text-base text-muted-foreground">
          Se actualiza mientras completas las secciones. El identificador se
          asigna al publicar.
        </p>
      </div>
    </MarcoFlujo>
  )
}
