'use client'

import { Check, Eye, EyeOff, PhoneCall } from 'lucide-react'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { rpc } from '@/orpc/cliente'
import { SubirImagen } from '@/components/subir-imagen'
import {
  RESPONSABLE_SERVICIOS,
  NIT_RESPONSABLE_SERVICIOS,
  AUTORIZACION_PROVEEDOR_VERSION,
  AUTORIZACION_FOTO_VERSION,
  AUTORIZACION_DIRECCION_VERSION,
} from '@/lib/config'
import { contienePII, MENSAJE_PII, validarSugerencia } from '@/lib/validacion'
import { useBorrador } from '@/lib/borrador'
// Del contrato y no de `lib/types`: es el mismo dato que va a pintar la
// aplicación de Expo, y una segunda copia se desincroniza (ADR 0001).
import type { GrupoOficio, OficioPropuesto } from '@/contrato/servicios'
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
  ubicacionCompleta,
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
import { useAviso } from '@/components/avisos'
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
  | 'foto'
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
  'foto',
  'permiso',
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

/**
 * Una subcategoría que esta persona escribió y todavía no existe (ADR 0013).
 *
 * No lleva `oficio_id` porque no lo tiene: no está en el catálogo. Se
 * identifica por su nombre dentro de esta pantalla, que basta porque la
 * lista es de ocho como mucho y no admite repetidos.
 */
type PropuestaLocal = {
  nombre: string
  grupo: GrupoOficio
  modo: ModoPrecio
  precio_desde: number | null
  unidad: UnidadPrecio | null
  /** Lo que dijo moderación, si ya dijo algo. */
  estado?: string
}

function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]
}

export function FormularioProveedor({
  proveedor,
  municipios,
  oficios,
  oficiosPropuestos,
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
  /**
   * Las subcategorías que esta persona propuso y todavía no existen en el
   * catálogo (ADR 0013). Vienen aparte de `proveedor.oficios` porque no
   * son oficios todavía: no tienen id de catálogo y no se publican.
   */
  oficiosPropuestos?: OficioPropuesto[]
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
  const avisar = useAviso()

  const [nombre, setNombre] = useState(proveedor?.nombre_visible ?? '')
  const [tipo, setTipo] = useState<TipoProveedor>(proveedor?.tipo ?? 'persona')
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? '')
  const [municipio, setMunicipio] = useState(proveedor?.municipio ?? '')
  const [zonaId, setZonaId] = useState(proveedor?.zona_id ?? '')
  const [zonaTexto, setZonaTexto] = useState(proveedor?.zona_texto ?? '')
  // La dirección, opcional, con su propia autorización (ADR 0017): otra
  // finalidad que publicar el nombre o el punto del mapa, artículo 9.
  const [direccion, setDireccion] = useState(proveedor?.direccion ?? '')
  const [autorizoDireccion, setAutorizoDireccion] = useState(
    proveedor?.acepto_direccion ?? false
  )
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
  // El stepper de la fila 03 (ADR 0013). Con ficha ya publicada nace en
  // el paso 3: nadie debería recorrer tres pasos para corregir un precio.
  const [pasoOficios, setPasoOficios] = useState<1 | 2 | 3>(proveedor ? 3 : 1)

  // El alta en seis pasos cortos, no un formulario de diez secciones de
  // una sentada: pedido literal del cliente, con «cuánto falta» siempre
  // a la vista. Solo se usa sin ficha y sin secciones sueltas (más abajo);
  // editando, cada pantalla de /perfil sigue pidiendo su sección.
  const [paso, setPaso] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)

  // Las categorías del paso 1. Con ficha, se deducen de lo que ya tiene:
  // guardarlas en la base sería una segunda fuente de verdad sobre algo
  // que los oficios ya dicen.
  const [categorias, setCategorias] = useState<GrupoOficio[]>(() => {
    const de = new Set<GrupoOficio>()
    for (const o of proveedor?.oficios ?? []) {
      const g = oficios.find((c) => c.id === o.oficio_id)?.grupo
      if (g) de.add(g as GrupoOficio)
    }
    for (const pr of oficiosPropuestos ?? []) de.add(pr.grupo)
    return [...de]
  })

  // Lo que propuso y todavía no existe. Mismo precio que un oficio de
  // verdad, para no volver a pedírselo el día que se apruebe.
  const [propuestas, setPropuestas] = useState<PropuestaLocal[]>(
    () =>
      (oficiosPropuestos ?? []).map((pr) => ({
        nombre: pr.nombre,
        grupo: pr.grupo,
        modo: pr.modo,
        precio_desde: pr.precio_desde,
        unidad: pr.unidad,
        estado: pr.estado,
      })),
  )

  // Lo que se está escribiendo en la caja de «¿no encuentras lo tuyo?»,
  // una por categoría: la propuesta nace con su categoría puesta.
  const [escribiendo, setEscribiendo] = useState<Record<string, string>>({})

  // ⚠ Con ficha ya publicada nace en `true`, y no es un atajo: la
  // autorización ya se dio y está guardada con su versión y su fecha. La
  // regla 6 dice que el consentimiento bloquea la publicación, no la
  // edición — pedirlo otra vez para corregir un teléfono convierte la
  // casilla en un trámite y le quita el peso que tiene la primera vez.
  const [autorizo, setAutorizo] = useState(!!proveedor)

  // La foto y su permiso. `fotoNueva` es la que se acaba de subir en esta
  // sesión; `teniaFoto` es la que ya estaba.
  //
  // ⚠ Aquí NO se hereda el permiso de la ficha como se hereda `autorizo`.
  // Es otra finalidad y otra casilla (v6-b7), y nace en lo que esa persona
  // marcó para la foto, ni más ni menos.
  const [fotoNueva, setFotoNueva] = useState<string | null>(null)
  // ⚠ Se escribía y nadie lo leía: el botón de publicar no se apagaba
  // mientras la foto subía, así que se podía publicar la ficha —o pasar
  // de paso— con la subida a medias.
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [autorizoFoto, setAutorizoFoto] = useState(proveedor?.acepto_foto ?? false)
  const [quitarFoto, setQuitarFoto] = useState(false)
  const teniaFoto = !!proveedor?.foto
  const estadoFoto =
    proveedor?.foto_estado === 'aprobada'
      ? 'Publicada'
      : proveedor?.foto_estado === 'rechazada'
        ? 'Rechazada'
        : 'En revisión'
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mecanismo 1 (CLAUDE.md): solo en el alta —sin ficha, sin secciones
  // sueltas de /perfil y sin token—, que es donde perder todo obliga a
  // volver a diligenciar diez secciones desde cero. Editando una ficha ya
  // publicada, lo que hay detrás es el servidor, no un formulario vacío.
  const enAlta = !proveedor && !secciones && !token
  const { limpiar: limpiarBorrador } = useBorrador(
    'aquive:borrador:proveedor:v1',
    {
      nombre,
      tipo,
      telefono,
      municipio,
      zonaId,
      zonaTexto,
      direccion,
      autorizoDireccion,
      modalidad,
      dias,
      franjas,
      mediosPago,
      descripcion,
      elegidos,
      categorias,
      propuestas,
      autorizo,
      fotoNueva,
      autorizoFoto,
      pasoOficios,
      paso,
    },
    (d) => {
      setNombre(d.nombre)
      setTipo(d.tipo)
      setTelefono(d.telefono)
      setMunicipio(d.municipio)
      setZonaId(d.zonaId)
      setZonaTexto(d.zonaTexto)
      setDireccion(d.direccion)
      setAutorizoDireccion(d.autorizoDireccion)
      setModalidad(d.modalidad)
      setDias(d.dias)
      setFranjas(d.franjas)
      setMediosPago(d.mediosPago)
      setDescripcion(d.descripcion)
      setElegidos(d.elegidos)
      setCategorias(d.categorias)
      setPropuestas(d.propuestas)
      setAutorizo(d.autorizo)
      setFotoNueva(d.fotoNueva)
      setAutorizoFoto(d.autorizoFoto)
      setPasoOficios(d.pasoOficios)
      setPaso(d.paso)
    },
    { habilitado: enAlta },
  )

  const zonasDelMunicipio = zonas.filter((z) => z.municipio === municipio)
  const nombreOficio = new Map(oficios.map((o) => [o.id, o]))

  // El teléfono que la persona está escribiendo NO pasa por contienePII:
  // es un teléfono, y esa es su razón de ser. Lo que sí se filtra es todo
  // lo demás, que es por donde se colaría un segundo número.
  const errorDescripcion = descripcion.trim() && contienePII(descripcion) ? MENSAJE_PII : null
  const errorZona = zonaTexto.trim() && contienePII(zonaTexto) ? MENSAJE_PII : null
  const errorDireccion = direccion.trim() && contienePII(direccion) ? MENSAJE_PII : null

  const nombreValido = nombre.trim().length >= 3 && nombre.trim().length <= 60
  const telefonoValido = /^[0-9+()\- ]{7,20}$/.test(telefono.trim())

  // El barrio es el dato principal y obligatorio; la comuna es secundaria
  // y nunca bloquea -«muchas personas no saben a cuál pertenecen»-; y la
  // dirección solo hace falta si se autoriza publicarla (ADR 0017).
  const hayUbicacion = ubicacionCompleta({
    municipio,
    barrio: zonaTexto,
    direccion,
    autorizaDireccion: autorizoDireccion,
  })

  // Lo único que cambia entre Cali y el resto es cómo se llama el campo:
  // donde hay comunas, esto es el barrio; donde no, es la única división
  // que la persona va a saber decir, y puede ser una vereda o un sector.
  const etiquetaZona = zonasDelMunicipio.length > 0 ? 'Barrio' : 'Barrio o vereda'

  const puedeGuardar =
    nombreValido &&
    telefonoValido &&
    hayUbicacion &&
    modalidad.length > 0 &&
    elegidos.length + propuestas.length > 0 &&
    !errorDescripcion &&
    !errorZona &&
    !errorDireccion &&
    descripcion.length <= 300 &&
    autorizo &&
    !subiendoFoto &&
    !guardando

  /** Cuántas cosas dice que hace, del catálogo o propuestas. */
  const cuantosOficios = elegidos.length + propuestas.length

  function alternarCategoria(grupo: GrupoOficio) {
    setCategorias((prev) => {
      if (!prev.includes(grupo)) return [...prev, grupo]
      // Quitar una categoría se lleva lo que se eligió dentro. Se avisa
      // antes con el número, porque perder cuatro oficios sin que nadie
      // lo diga se lee como que la aplicación los borró sola.
      const dentro = oficios.filter((o) => o.grupo === grupo).map((o) => o.id)
      setElegidos((e) => e.filter((x) => !dentro.includes(x.oficio_id)))
      setPropuestas((ps) => ps.filter((x) => x.grupo !== grupo))
      return prev.filter((g) => g !== grupo)
    })
  }

  /** Cuántas cosas elegidas se perderían al soltar esta categoría. */
  function cuantasDentro(grupo: GrupoOficio) {
    const dentro = new Set(oficios.filter((o) => o.grupo === grupo).map((o) => o.id))
    return (
      elegidos.filter((e) => dentro.has(e.oficio_id)).length +
      propuestas.filter((x) => x.grupo === grupo).length
    )
  }

  function agregarPropuesta(grupo: GrupoOficio) {
    const nombre = (escribiendo[grupo] ?? '').trim()
    if (nombre.length < 2 || validarSugerencia(nombre)) return
    if (cuantosOficios >= TOPE_OFICIOS) return
    setPropuestas((prev) =>
      prev.some((x) => x.nombre.toLowerCase() === nombre.toLowerCase() && x.grupo === grupo)
        ? prev
        : [...prev, { nombre, grupo, modo: 'normal', precio_desde: null, unidad: null }],
    )
    setEscribiendo((prev) => ({ ...prev, [grupo]: '' }))
  }

  function cambiarPropuesta(nombre: string, cambio: Partial<PropuestaLocal>) {
    setPropuestas((prev) =>
      prev.map((x) => (x.nombre === nombre ? { ...x, ...cambio } : x)),
    )
  }

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
      // La dirección se guarda siempre que se escriba, autorizada o no
      // (ADR 0017): es la vista pública la que decide qué enseña.
      p_direccion: direccion.trim() || null,
      p_acepto_direccion: autorizoDireccion,
      p_direccion_version: autorizoDireccion ? AUTORIZACION_DIRECCION_VERSION : null,
      p_token: token ?? null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setGuardando(false)
      return
    }

    // Las subcategorías propuestas, por el contrato y por lo mismo que la
    // foto: `guardar_proveedor` escribe la ficha entera de una vez y
    // funciona, y una escritura nueva no tiene por qué entrar a vivir
    // dentro de una función grande que ya sirve (ADR 0013).
    try {
      await rpc.servicios.guardarOficiosPropuestos({
        propuestas: propuestas.map((x) => ({
          nombre: x.nombre,
          grupo: x.grupo,
          modo: x.modo,
          precio_desde: x.precio_desde,
          unidad: x.unidad,
        })),
        oficios_del_catalogo: elegidos.length,
      })
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudieron guardar los oficios que escribiste.')
      setGuardando(false)
      return
    }

    // La foto va por el contrato y no por la RPC de la ficha: quitarla
    // tiene que borrar además el objeto del almacén, y `on delete cascade`
    // no borra un archivo de un bucket (regla 3). Eso es código.
    if (fotoNueva || quitarFoto || autorizoFoto !== (proveedor?.acepto_foto ?? false)) {
      try {
        await rpc.servicios.guardarFoto(
          quitarFoto || !autorizoFoto
            ? { imagen_id: null, autorizacion_version: null }
            : {
                imagen_id: fotoNueva,
                autorizacion_version: AUTORIZACION_FOTO_VERSION,
              },
        )
      } catch {
        // La ficha ya se guardó. Que falle la foto no puede tirar abajo lo
        // demás, pero sí hay que decirlo.
        setError('La ficha se guardó, pero la foto no. Inténtalo otra vez desde «Tu foto».')
        setGuardando(false)
        return
      }
    }

    if (secciones) {
      router.push(volver ?? '/perfil')
    } else if (token) {
      // Ya no hay ruta por token: la ficha cuelga de la cuenta (ADR 0006)
      // y se llega a ella desde el perfil, como todo lo demás.
      router.push('/servicios/soy-proveedor')
    } else {
      // Recién creada va a la confirmación (pantalla 04), que es donde se
      // dice por qué el carné todavía no lleva sello. Ya creada, vuelve a
      // la ficha publicada.
      router.push(proveedor ? '/servicios/soy-proveedor' : '/servicios/soy-proveedor/listo')
    }
    limpiarBorrador()
    avisar(proveedor ? 'Guardado' : 'Ficha publicada')
    router.refresh()
  }

  async function borrar() {
    if (!confirm('¿Seguro? Se borra tu ficha y las calificaciones que hayas recibido. Esto no se puede deshacer.')) {
      return
    }
    setGuardando(true)
    // Por el contrato: borrar la ficha borra además su foto del almacén, y
    // eso no lo puede hacer una función de Postgres (regla de producto 3).
    try {
      await rpc.servicios.borrarFicha()
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo borrar. Inténtalo otra vez.')
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
      resumen: zonaTexto.trim() || 'Falta tu barrio',
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

              {/* El barrio es el dato principal y obligatorio; la comuna
                  queda del todo aparte y nunca bloquea (ADR 0017): muchas
                  personas no saben a cuál comuna pertenecen. */}
              <div className="mt-2">
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
                {!hayUbicacion && (
                  <p className="mt-1 text-sm text-muted-foreground">Falta tu barrio.</p>
                )}
              </div>

              {zonasDelMunicipio.length > 0 && (
                <div className="mt-3">
                  <Label>
                    Comuna o corregimiento{' '}
                    <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
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
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sirve para filtrar búsquedas. Si no sabes cuál es la tuya, déjalo así.
                  </p>
                </div>
              )}

              {/* La dirección: opcional, y publicarla es OTRA finalidad que
                  publicar el nombre o el punto del mapa (ADR 0017, artículo 9
                  de la Ley 1581). Se guarda siempre que se escriba; lo que la
                  casilla decide es si se muestra. */}
              <div className="mt-4">
                <Label htmlFor="direccion">
                  Dirección{' '}
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="direccion"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  maxLength={120}
                  placeholder="Calle 5 #23-40, local 2"
                  className="mt-1"
                />
                {errorDireccion && (
                  <p className="mt-1 text-sm text-destructive">{errorDireccion}</p>
                )}

                <div className="mt-2 rounded-2xl bg-background p-4">
                  <label className="flex items-start gap-3 text-base">
                    <input
                      type="checkbox"
                      checked={autorizoDireccion}
                      onChange={(e) => setAutorizoDireccion(e.target.checked)}
                      className="mt-1 size-5 shrink-0"
                    />
                    <span className="font-semibold">
                      {autorizoDireccion ? 'Mostrar mi dirección' : 'Mantener mi dirección privada'}
                    </span>
                  </label>
                  <details className="mt-2 text-sm text-muted-foreground">
                    <summary className="cursor-pointer select-none">
                      Qué autorizo exactamente
                    </summary>
                    <p className="mt-2">
                      Autorizo a {RESPONSABLE_SERVICIOS}, NIT {NIT_RESPONSABLE_SERVICIOS},
                      responsable del directorio de servicios de AquíVe, a publicar mi
                      dirección de forma <strong>pública</strong> en internet, para que
                      quien busque mi trabajo sepa cómo llegar. Entiendo que puedo
                      quitarla cuando quiera, y que si no marco esta casilla mi dirección
                      no se muestra a nadie aunque la haya escrito aquí.
                    </p>
                  </details>
                  {autorizoDireccion && !direccion.trim() && (
                    <p className="mt-2 text-sm text-destructive">
                      Escribe tu dirección arriba antes de autorizar publicarla.
                    </p>
                  )}
                </div>
              </div>
            </fieldset>
          )}

          <fieldset className="mt-4">
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
        cuantosOficios === 0
          ? 'Sin oficios todavía'
          : `${cuantosOficios} ${cuantosOficios === 1 ? 'oficio' : 'oficios'}`,
      falta: cuantosOficios === 0,
      cuerpo: (
        <div>
          {/* Tres pasos, no ochenta y una píldoras (ADR 0013). Con el ADR
              0012 el catálogo subió a 81 oficios y esta sección los pintaba
              todos a la vez, en un teléfono, dentro de un formulario que ya
              tiene diez secciones. */}
          <ol className="mb-4 grid grid-cols-3 gap-2 text-sm">
            {['En qué trabajas', 'Qué haces', 'Cuánto cobras'].map((nombre, i) => (
              <li key={nombre} className="min-w-0">
                <button
                  type="button"
                  // Ir hacia atrás siempre; hacia adelante solo si hay de
                  // qué hablar en el paso siguiente.
                  disabled={i + 1 > pasoOficios && categorias.length === 0}
                  onClick={() => setPasoOficios((i + 1) as 1 | 2 | 3)}
                  aria-current={i + 1 === pasoOficios ? 'step' : undefined}
                  className={`block w-full truncate border-t-2 pt-1.5 text-left ${
                    i + 1 === pasoOficios
                      ? 'border-enlace font-semibold text-foreground'
                      : i + 1 < pasoOficios
                        ? 'border-ok text-muted-foreground'
                        : 'border-border text-muted-foreground'
                  }`}
                >
                  {nombre}
                </button>
              </li>
            ))}
          </ol>

          {/* ----------------------------------------------- paso 1 */}
          {pasoOficios === 1 && (
            <fieldset>
              <legend className="text-base font-medium">¿En qué trabajas?</legend>
              <p className="mt-1 text-base text-muted-foreground">
                Marca todas las que hagas. En el siguiente paso eliges
                exactamente qué haces dentro de cada una.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(GRUPOS).map(([grupo, etiqueta]) => {
                  const dentro = cuantasDentro(grupo as GrupoOficio)
                  return (
                    <Chip
                      key={grupo}
                      activo={categorias.includes(grupo as GrupoOficio)}
                      onClick={() => {
                        // Soltar una categoría con cosas dentro avisa antes:
                        // que desaparezcan cuatro oficios sin que nadie lo
                        // diga se lee como que la aplicación los borró sola.
                        if (
                          dentro > 0 &&
                          !confirm(
                            `Si quitas «${etiqueta}» se van también ${dentro} ${
                              dentro === 1 ? 'cosa que elegiste' : 'cosas que elegiste'
                            }. ¿Sigo?`,
                          )
                        ) {
                          return
                        }
                        alternarCategoria(grupo as GrupoOficio)
                      }}
                    >
                      {etiqueta}
                      {dentro > 0 ? ` · ${dentro}` : ''}
                    </Chip>
                  )
                })}
              </div>

              <Button
                className="mt-4 w-full"
                disabled={categorias.length === 0}
                onClick={() => setPasoOficios(2)}
              >
                Continuar
              </Button>
            </fieldset>
          )}

          {/* ----------------------------------------------- paso 2 */}
          {pasoOficios === 2 && (
            <fieldset>
              <legend className="text-base font-medium">¿Qué haces exactamente?</legend>
              <p className="mt-1 text-base text-muted-foreground">
                Marca lo que de verdad haces, hasta {TOPE_OFICIOS}. Es lo que la
                gente va a buscar.
              </p>

              <div className="mt-3 space-y-5">
                {categorias.map((grupo) => {
                  const delGrupo = oficios.filter((o) => o.grupo === grupo)
                  const escrito = escribiendo[grupo] ?? ''
                  const errorEscrito = escrito.trim()
                    ? validarSugerencia(escrito.trim())
                    : null
                  return (
                    <div key={grupo}>
                      <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
                        {GRUPOS[grupo as keyof typeof GRUPOS]}
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
                        {propuestas
                          .filter((x) => x.grupo === grupo)
                          .map((x) => (
                            <Chip
                              key={x.nombre}
                              activo
                              onClick={() =>
                                setPropuestas((prev) =>
                                  prev.filter((y) => y.nombre !== x.nombre),
                                )
                              }
                            >
                              {x.nombre} · lo revisamos
                            </Chip>
                          ))}
                      </div>

                      {/* ⚠ Siempre a la vista, una por categoría, para que
                          la propuesta nazca con su categoría puesta. */}
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={escrito}
                          onChange={(e) =>
                            setEscribiendo((prev) => ({ ...prev, [grupo]: e.target.value }))
                          }
                          maxLength={60}
                          className="min-w-0 flex-1 bg-background"
                          aria-label={`¿No encuentras lo tuyo en ${GRUPOS[grupo as keyof typeof GRUPOS]}?`}
                          placeholder="¿No encuentras lo tuyo? Escríbelo"
                        />
                        <Button
                          variant="outline"
                          className="shrink-0"
                          disabled={
                            escrito.trim().length < 2 ||
                            !!errorEscrito ||
                            cuantosOficios >= TOPE_OFICIOS
                          }
                          onClick={() => agregarPropuesta(grupo)}
                        >
                          Agregar
                        </Button>
                      </div>
                      {errorEscrito && (
                        <p className="mt-1 text-sm text-destructive">{errorEscrito}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              <p className="mt-4 text-base text-muted-foreground">
                {cuantosOficios} de {TOPE_OFICIOS}.
                {cuantosOficios >= TOPE_OFICIOS
                  ? ' Quita alguna para poner otra.'
                  : ''}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setPasoOficios(1)}>
                  Volver
                </Button>
                <Button
                  className="flex-1"
                  disabled={cuantosOficios === 0}
                  onClick={() => setPasoOficios(3)}
                >
                  Continuar
                </Button>
              </div>
            </fieldset>
          )}

          {/* ----------------------------------------------- paso 3 */}
          {pasoOficios === 3 && (
            <fieldset>
              <legend className="text-base font-medium">¿Cuánto cobras?</legend>
              <p className="mt-1 text-base text-muted-foreground">
                Di desde cuánto cobras cada cosa. Es información: aquí no se
                paga nada y nadie te cobra comisión.
              </p>

              {cuantosOficios === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-base text-muted-foreground">
                  Todavía no has elegido nada.
                </p>
              ) : (
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

                  {/* Las propuestas, con el mismo bloque de precio. Se les
                      dice que no se publican todavía: es la diferencia con
                      la solicitud, que sí sale de inmediato (ADR 0013). */}
                  {propuestas.map((x) => {
                    const cobra = x.modo === 'solidario' || x.modo === 'normal'
                    return (
                      <li key={x.nombre} className="rounded-2xl bg-card p-3 shadow-canto">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-heading text-lg leading-tight">{x.nombre}</p>
                          <span className="font-heading rounded-full bg-accent px-3 py-0.5 text-xs tracking-[0.085em] text-accent-foreground uppercase">
                            {x.estado === 'rechazada' ? 'No aprobada' : 'En revisión'}
                          </span>
                        </div>
                        <p className="font-heading mt-0.5 text-xs tracking-[0.085em] text-muted-foreground uppercase">
                          {GRUPOS[x.grupo as keyof typeof GRUPOS]}
                        </p>
                        <p className="mt-2 rounded-xl bg-accent px-3 py-2 text-base text-accent-foreground">
                          Lo escribiste tú. No aparece en el directorio hasta que
                          alguien lo revise; el resto de tu ficha sí se publica.
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {MODOS_PRECIO.map((m) => (
                            <Chip
                              key={m.valor}
                              activo={x.modo === m.valor}
                              onClick={() =>
                                cambiarPropuesta(x.nombre, {
                                  modo: m.valor as ModoPrecio,
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
                              value={x.precio_desde ?? ''}
                              onChange={(ev) =>
                                cambiarPropuesta(x.nombre, {
                                  precio_desde:
                                    ev.target.value === '' ? null : Number(ev.target.value),
                                })
                              }
                              placeholder="Desde cuánto (opcional)"
                              aria-label={`Precio desde, ${x.nombre}`}
                              className="min-w-0 flex-1"
                            />
                            <Select
                              value={x.unidad ?? ''}
                              onValueChange={(v) =>
                                cambiarPropuesta(x.nombre, {
                                  unidad: (v || null) as UnidadPrecio | null,
                                })
                              }
                            >
                              <SelectTrigger
                                aria-label={`Unidad, ${x.nombre}`}
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

              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setPasoOficios(2)}
              >
                Cambiar lo que haces
              </Button>
            </fieldset>
          )}
        </div>
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

    foto: {
      titulo: 'Tu foto',
      resumen: autorizoFoto
        ? fotoNueva
          ? 'Subida, en revisión'
          : teniaFoto
            ? estadoFoto
            : 'Falta subirla'
        : 'Sin foto',
      // No falta nunca: una ficha sin foto es una ficha completa. La mitad
      // del rebusque no va a subir una, y marcarlo en rojo convertiría «no
      // quise» en «me equivoqué».
      falta: false,
      cuerpo: (
        <div className="space-y-3">
          <p className="text-base text-muted-foreground">
            Es opcional. Una foto tuya o de tu negocio ayuda a que te
            reconozcan, pero se puede publicar la ficha sin ninguna.
          </p>

          {teniaFoto && !fotoNueva && (
            <p className="text-base">
              Ya tienes una foto: <strong>{estadoFoto.toLowerCase()}</strong>.
              Si subes otra, la anterior se borra.
            </p>
          )}

          <SubirImagen
            objetoTipo="proveedor"
            onSubida={setFotoNueva}
            onEstadoSubida={setSubiendoFoto}
          />

          {/* Casilla APARTE de la de publicar la ficha. Publicar una cara es
              otra finalidad que publicar un teléfono, y el artículo 9 pide
              autorización por finalidad. Guarda su propia versión y fecha. */}
          <div className="rounded-2xl bg-background p-4">
            <label className="flex items-start gap-3 text-base">
              <input
                type="checkbox"
                checked={autorizoFoto}
                onChange={(e) => setAutorizoFoto(e.target.checked)}
                className="mt-1 size-5 shrink-0"
              />
              <span>
                Autorizo a {RESPONSABLE_SERVICIOS} a publicar esta foto en mi
                ficha, de forma <strong>pública</strong> en internet, para que
                quien busque mi trabajo me reconozca.
                <br />
                <br />
                Entiendo que una persona la revisa antes de que se vea, que
                puedo quitarla cuando quiera, y que al quitarla{' '}
                <strong>el archivo se borra</strong>. Es un permiso aparte del
                de publicar mi ficha.
              </span>
            </label>
          </div>

          {(teniaFoto || fotoNueva) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFotoNueva(null)
                setAutorizoFoto(false)
                setQuitarFoto(true)
              }}
            >
              Quitar mi foto
            </Button>
          )}
          {quitarFoto && (
            <p className="text-base text-muted-foreground">
              Se borra al guardar.
            </p>
          )}
        </div>
      ),
    },

    permiso: {
      titulo: 'Permiso de publicación',
      resumen: autorizo ? 'Aceptado' : 'Falta tu autorización',
      falta: !autorizo,
      cuerpo: (
        /* ADR 0017: la casilla dice una frase corta -sin el nombre de la
           Fundación en la línea que se ve de entrada-, y el texto legal
           completo -con el nombre y el NIT, palabra por palabra, sin
           recortar- va en un <details> debajo, plegado. El artículo 12 de
           la Ley 1581 obliga a identificar al responsable, así que el
           nombre se queda: lo que cambia es qué tan visible es de entrada.
           La versión guardada sigue siendo AUTORIZACION_PROVEEDOR_VERSION,
           y no se mueve porque el texto legal no cambió, solo dónde vive. */
        <div className="rounded-2xl bg-background p-4">
          <label className="flex items-start gap-3 text-base">
            <input
              type="checkbox"
              checked={autorizo}
              onChange={(e) => setAutorizo(e.target.checked)}
              className="mt-1 size-5 shrink-0"
            />
            <span className="font-semibold">Autorizo la publicación de mis datos</span>
          </label>
          <details className="mt-3 text-sm text-muted-foreground">
            <summary className="cursor-pointer select-none">Leer el texto completo</summary>
            <p className="mt-2">
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
            </p>
          </details>
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
  // 3 · El alta, en seis pasos cortos y no diez secciones de una sentada:
  //     pedido literal del cliente, con «cuánto falta» siempre a la vista.
  //
  //     Nombrados y no numerados —«Paso 2 de 6» no dice de qué es el
  //     2—, mismo criterio que ya usa `formulario-publicar-servicio.tsx`
  //     y el asistente de `formulario-registro.tsx`: `MarcoFlujo` ya trae
  //     esa barra con `pasos`/`pasoActual`.
  //
  //     Los pasos se abren aquí y no saltan a /perfil a propósito:
  //     `guardar_proveedor` escribe la ficha entera de una vez —nombre,
  //     teléfono, municipio, zona y al menos un oficio son NOT NULL—, así
  //     que antes de publicar no hay ficha de la que colgar una pantalla
  //     suelta. Después de publicar sí, y la 15 lleva a cada una.
  // ─────────────────────────────────────────────────────────────────

  const PASOS: { nombre: string; claves: ClaveSeccion[] }[] = [
    { nombre: 'Quién eres', claves: ['quien', 'figura'] },
    { nombre: 'Contacto', claves: ['contacto'] },
    { nombre: 'Ubicación', claves: ['ciudad', 'zonas'] },
    { nombre: 'Qué ofreces', claves: ['oficios', 'disponibilidad', 'presentacion'] },
    { nombre: 'Tu foto', claves: ['foto'] },
    { nombre: 'Confirmar', claves: ['permiso'] },
  ]

  // Falta algo más que lo que ya marca `BLOQUES[c].falta` en los pasos de
  // ubicación (el filtro de PII de la dirección) y de foto (que no se
  // avance con la subida a medias).
  const pasoValido: Record<number, boolean> = {
    1: !BLOQUES.quien.falta,
    2: !BLOQUES.contacto.falta,
    3: !BLOQUES.ciudad.falta && !BLOQUES.zonas.falta && !errorDireccion,
    4: !BLOQUES.oficios.falta,
    5: !subiendoFoto,
    6: !BLOQUES.permiso.falta,
  }

  return (
    <MarcoFlujo
      titulo="Arma tu carné"
      volver="/inicio"
      pasos={PASOS.map((p) => p.nombre)}
      pasoActual={paso - 1}
      accion={
        <div className="flex gap-2">
          {paso > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaso((n) => (n - 1) as typeof paso)}
            >
              Atrás
            </Button>
          )}
          {paso < 6 ? (
            <Button
              type="button"
              className="flex-1"
              disabled={!pasoValido[paso]}
              onClick={() => setPaso((n) => (n + 1) as typeof paso)}
            >
              Continuar
            </Button>
          ) : (
            <Button type="button" className="flex-1" disabled={!puedeGuardar} onClick={guardar}>
              <Check className="size-5" aria-hidden="true" />
              {guardando ? 'Guardando…' : 'Publicar mi carné'}
            </Button>
          )}
        </div>
      }
    >
      {paso === 1 && (
        <p className="mb-4 text-base text-muted-foreground">
          Tu nombre, tu teléfono y lo que haces quedan públicos en internet. Tú
          acuerdas el precio con cada persona: AquíVe no cobra nada.
        </p>
      )}

      {avisoError && <div className="mb-4">{avisoError}</div>}

      <div className="space-y-4">
        {PASOS[paso - 1].claves.map((c) => (
          <section key={c} className="shadow-canto space-y-4 rounded-2xl bg-card p-4">
            <h2 className="font-heading text-xl leading-tight">{BLOQUES[c].titulo}</h2>
            {BLOQUES[c].cuerpo}
          </section>
        ))}
      </div>

      {/* Lo que la pantalla 14 anterior decía en sus dos filas cerradas:
          esto no se pide todavía porque hace falta que la ficha exista
          primero. Va en el último paso para que no quede como una
          sorpresa después de publicar. */}
      {paso === 6 && (
        <p className="mt-4 text-base text-muted-foreground">
          Después de publicar: alguien de {RESPONSABLE_SERVICIOS} te llama para
          verificar tu teléfono, y desde tu perfil puedes dar la referencia de
          un cliente anterior.
        </p>
      )}

      {/* La vista previa, en vivo. Es la misma pieza que se publica —el
          carné de la pantalla 15 y de la 04—, así que quien la mira aquí
          ve exactamente lo que va a quedar. */}
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
          Se actualiza mientras completas los pasos. El identificador se
          asigna al publicar.
        </p>
      </div>
    </MarcoFlujo>
  )
}
