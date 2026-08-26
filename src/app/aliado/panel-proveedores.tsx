'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BadgeCheck, Copy, Phone, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { contienePII, MENSAJE_PII } from '@/lib/validacion'
import { nombreConDepartamento, type MunicipioBasico } from '@/lib/municipios'
import { GRUPOS, MODALIDADES, TIPOS_PROVEEDOR } from '@/lib/servicios'
import type {
  Database,
  ModalidadServicio,
  TipoProveedor,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export interface ProveedorDeOrganizacion {
  id: string
  nombre_visible: string
  telefono: string
  telefono_verificado: boolean
  municipio: string
  suspendido: boolean
  creado_at: string
  oficios: string[] | null
  referencias_pendientes: number
  referencias_confirmadas: number
  oficios_esperando: number
}

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

/**
 * La pestaña del equipo de una fundación para el directorio de servicios.
 *
 * Dos trabajos, los dos manuales a propósito: registrar a quien no tiene
 * cuenta de Google (§8 del documento fuente) y llamar a un número para
 * verificarlo (regla V). No hay OTP y no lo va a haber.
 */
export function PanelProveedores({
  organizacionId,
  proveedores,
  municipios,
  oficios,
  zonas,
  origen,
}: {
  organizacionId: string
  proveedores: ProveedorDeOrganizacion[]
  municipios: MunicipioBasico[]
  oficios: Oficio[]
  zonas: Zona[]
  origen: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [llamado, setLlamado] = useState(false)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoProveedor>('persona')
  const [telefono, setTelefono] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [zonaId, setZonaId] = useState('')
  const [zonaTexto, setZonaTexto] = useState('')
  const [modalidad, setModalidad] = useState<ModalidadServicio[]>([])
  const [elegidos, setElegidos] = useState<string[]>([])
  const [leiTexto, setLeiTexto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El token en claro. Existe solo en esta variable y desaparece al
  // recargar: si el aliado cierra sin copiarlo, hay que registrar de
  // nuevo. Se le dice en pantalla, en grande.
  const [enlace, setEnlace] = useState<{ nombre: string; url: string } | null>(null)

  const zonasDelMunicipio = zonas.filter((z) => z.municipio === municipio)
  const municipioElegido = municipios.find((m) => m.codigo_dane === municipio)
  const errorZona = zonaTexto.trim() && contienePII(zonaTexto) ? MENSAJE_PII : null

  const hayUbicacion = zonaId !== '' || zonaTexto.trim().length >= 2

  const puedeGuardar =
    nombre.trim().length >= 3 &&
    /^[0-9+()\- ]{7,20}$/.test(telefono.trim()) &&
    municipio !== '' &&
    hayUbicacion &&
    modalidad.length > 0 &&
    elegidos.length > 0 &&
    !errorZona &&
    leiTexto &&
    !guardando

  function limpiar() {
    setNombre('')
    setTipo('persona')
    setTelefono('')
    setMunicipio('')
    setZonaId('')
    setZonaTexto('')
    setModalidad([])
    setElegidos([])
    setLeiTexto(false)
    setAbierto(false)
  }

  async function registrar() {
    if (!puedeGuardar) return
    setGuardando(true)
    setError(null)

    const respuesta = await fetch('/api/servicios/proveedores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizacion_id: organizacionId,
        nombre: nombre.trim(),
        tipo,
        telefono: telefono.trim(),
        municipio,
        zona_id: zonaId || null,
        zona_texto: zonaTexto.trim() || null,
        modalidad,
        // Todos entran en «precio normal» y sin monto: el aliado no puede
        // inventarle la tarifa a nadie. La persona la pone después desde
        // su enlace.
        oficios: elegidos.map((id) => ({ oficio_id: id, modo: 'normal' })),
      }),
    })

    const datos = await respuesta.json()
    if (!respuesta.ok) {
      setError(datos.error ?? 'No se pudo registrar')
      setGuardando(false)
      return
    }

    // Si de verdad se llamo, el sello se pone aqui mismo con la misma
    // RPC que usa el boton de la lista: es una llamada mas, no un argumento
    // nuevo en la de crear.
    if (llamado && datos.id) await verificar(datos.id, true)

    setEnlace({
      nombre: nombre.trim(),
      url: `${origen}/servicios/mi-perfil/${datos.token}`,
    })
    setGuardando(false)
    limpiar()
    router.refresh()
  }

  async function verificar(id: string, valor: boolean) {
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('verificar_telefono_proveedor', {
      p_proveedor_id: id,
      p_verificado: valor,
    })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-6">
      {enlace && (
        <Alert className="mb-4">
          <AlertDescription>
            <p className="text-base font-medium">
              Listo. Este es el enlace de {enlace.nombre}:
            </p>
            <p className="mt-2 break-all font-mono text-sm">{enlace.url}</p>
            <p className="mt-2 text-sm">
              <strong>Se muestra una sola vez.</strong> Cópialo y dáselo ahora:
              es la única forma que tiene esa persona de cambiar o borrar su
              ficha, y no lo podemos recuperar. Si se pierde, hay que
              registrarla de nuevo.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(enlace.url)}
              >
                <Copy className="size-4" aria-hidden="true" />
                Copiar enlace
              </Button>
              <Button variant="ghost" onClick={() => setEnlace(null)}>
                Ya lo entregué
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!abierto ? (
        <Button className="w-full sm:w-auto" onClick={() => setAbierto(true)}>
          Registrar a alguien
        </Button>
      ) : (
        <div className="space-y-4 rounded-2xl bg-card p-4 shadow-sm">
          {/* Para leer en voz alta, con la persona enfrente: lo que se va a
              publicar son sus datos, no los de quien llena el formulario. */}
          <p className="flex items-start gap-2 rounded-xl bg-secondary p-3 text-base text-secondary-foreground">
            <Info className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
            <span>
              Estás publicando datos de otra persona en internet. Léele en voz
              alta lo que va a quedar público antes de guardar.
            </span>
          </p>

          <p className="text-base text-muted-foreground">
            Pide lo mínimo: el resto —precios, horarios, descripción— lo
            completa la persona desde su enlace.
          </p>

          <div>
            <Label htmlFor="p-nombre">Cómo quiere que la llamen</Label>
            <Input
              id="p-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              className="mt-1"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {TIPOS_PROVEEDOR.map((t) => (
              <Chip key={t.valor} activo={tipo === t.valor} onClick={() => setTipo(t.valor)}>
                {t.etiqueta}
              </Chip>
            ))}
          </div>

          <div>
            <Label htmlFor="p-telefono">Teléfono</Label>
            <Input
              id="p-telefono"
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              maxLength={20}
              className="mt-1"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              Queda público.
            </p>

            {/* ⚠ Nunca marcada de entrada, y nunca la marca el sistema: el
                sello de «teléfono verificado» significa exactamente que una
                persona llamó a ese número y alguien contestó. Si esto se
                marcara solo, el sello dejaría de querer decir nada — y es uno
                de los tres que sostienen la regla S. */}
            <label className="mt-2 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-muted p-3 has-checked:bg-accent">
              <input
                type="checkbox"
                checked={llamado}
                onChange={(e) => setLlamado(e.target.checked)}
                className="mt-0.5 size-6 shrink-0"
              />
              <span>
                <span className="text-base font-medium">
                  Llamé a este número y contestó
                </span>
                <span className="block text-sm text-muted-foreground">
                  Es lo único que significa el sello de «teléfono verificado».
                  Márcalo solo si de verdad llamaste.
                </span>
              </span>
            </label>
          </div>

          <div>
            <Label>Municipio</Label>
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
              <ComboboxTrigger aria-label="Municipio" className="mt-1 bg-background">
                <ComboboxValue placeholder="Elige el municipio" />
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

          {municipio !== '' && (
            <fieldset>
              <legend className="text-base font-medium">¿En qué parte?</legend>

              {zonasDelMunicipio.length > 0 && (
                <div className="mt-2">
                  <Label>Comuna o corregimiento</Label>
                  <Select value={zonaId} onValueChange={(v) => setZonaId(v ?? '')}>
                    <SelectTrigger aria-label="Comuna" className="mt-1 bg-background">
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
                <Label htmlFor="p-zona">
                  {zonasDelMunicipio.length > 0 ? 'Barrio' : 'Barrio o vereda'}
                </Label>
                <Input
                  id="p-zona"
                  value={zonaTexto}
                  onChange={(e) => setZonaTexto(e.target.value)}
                  maxLength={60}
                  className="mt-1"
                />
                {zonasDelMunicipio.length === 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ese municipio todavía no tiene comunas cargadas. Lo que
                    escribas entra a la cola de zonas por revisar y, cuando se
                    apruebe, queda en la lista para los demás.
                  </p>
                )}
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
            <legend className="mb-2 text-base font-medium">¿Dónde atiende?</legend>
            <div className="flex flex-wrap gap-2">
              {MODALIDADES.map((m) => (
                <Chip
                  key={m.valor}
                  activo={modalidad.includes(m.valor)}
                  onClick={() =>
                    setModalidad((p) =>
                      p.includes(m.valor) ? p.filter((x) => x !== m.valor) : [...p, m.valor]
                    )
                  }
                >
                  {m.etiqueta}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-base font-medium">¿Qué hace?</legend>
            <div className="space-y-3">
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
                          activo={elegidos.includes(o.id)}
                          onClick={() =>
                            setElegidos((p) =>
                              p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]
                            )
                          }
                        >
                          {o.nombre}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </fieldset>

          {/* La declaración del aliado. Es lo único que queda si algún día
              esta persona dice que nunca autorizó nada, así que se pide
              explícita y no se da por hecha. */}
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-base">
            <input
              type="checkbox"
              checked={leiTexto}
              onChange={(e) => setLeiTexto(e.target.checked)}
              className="mt-1 size-5 shrink-0"
            />
            <span>
              Le leí a esta persona qué datos suyos se van a publicar en
              internet —su nombre, su teléfono, sus oficios y su zona—, que la
              ficha no se borra sola, y que con su enlace puede cambiarla o
              borrarla cuando quiera. Aceptó.
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button onClick={registrar} disabled={!puedeGuardar}>
              {guardando ? 'Registrando…' : 'Registrar y generar enlace'}
            </Button>
            <Button variant="ghost" onClick={limpiar} disabled={guardando}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <h3 className="font-heading mt-8 text-2xl">Fichas de la organización</h3>

      {proveedores.length === 0 ? (
        <p className="mt-3 text-base text-muted-foreground">
          Todavía no han registrado a nadie.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {proveedores.map((p) => (
            <li key={p.id} className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/servicios/${p.id}`}
                  className="text-base font-bold underline-offset-4 hover:underline"
                >
                  {p.nombre_visible}
                </Link>
                {p.telefono_verificado ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok-suave px-2.5 py-0.5 text-sm font-medium text-foreground">
                    <BadgeCheck className="size-4" aria-hidden="true" />
                    Verificado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-accent px-2.5 py-0.5 text-sm font-medium text-accent-foreground">
                    Sin verificar
                  </span>
                )}
              </div>

              {p.oficios && p.oficios.length > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.oficios.join(' · ')}
                </p>
              )}

              {p.oficios_esperando > 0 && (
                <p className="mt-2 text-sm text-accent-foreground">
                  {p.oficios_esperando === 1
                    ? 'Un oficio suyo no se publica'
                    : `${p.oficios_esperando} oficios suyos no se publican`}{' '}
                  hasta que el teléfono esté verificado y tenga una referencia
                  confirmada. Referencias: {p.referencias_confirmadas} confirmadas,{' '}
                  {p.referencias_pendientes} por revisar.
                </p>
              )}

              {p.suspendido && (
                <p className="mt-2 text-sm text-accent-foreground">
                  Suspendida por moderación. No aparece en el directorio.
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<a href={`tel:${p.telefono}`} />}
                >
                  <Phone className="size-4" aria-hidden="true" />
                  Llamar al {p.telefono}
                </Button>
                <Button
                  variant={p.telefono_verificado ? 'ghost' : 'default'}
                  onClick={() => verificar(p.id, !p.telefono_verificado)}
                >
                  {p.telefono_verificado ? 'Quitar la verificación' : 'Contestó: verificar'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
