'use client'

import { useState } from 'react'
import Link from 'next/link'

import { rpc } from '@/orpc/cliente'

import { contienePII, validarNota } from '@/lib/validacion'
import { nombreConDepartamento, type MunicipioBasico } from '@/lib/municipios'
import { CAPACIDADES_PAGO, GRUPOS, URGENCIAS } from '@/lib/servicios'
import type { CapacidadPago, Database, UrgenciaServicio } from '@/lib/types'
import type { GrupoOficio, Subcategoria } from '@/contrato/servicios'
import { validarSugerencia } from '@/lib/validacion'
import { TurnstileWidget } from '@/components/turnstile-widget'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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

type Zona = Database['public']['Tables']['zonas']['Row']

/**
 * Tres pantallas, como manda la accesibilidad de CLAUDE.md: qué necesito,
 * dónde y cuándo, y enviar. Ni una más.
 *
 * ⚠ El primer paso tiene DOS momentos desde el ADR 0013, y sigue siendo un
 * paso: primero la categoría, y solo entonces las subcategorías de esa
 * categoría. Doce píldoras y luego siete u ocho, nunca ochenta y una.
 *
 * El ADR 0011 había quitado el catálogo entero de aquí porque eran cuarenta
 * y tantas píldoras juntas y quien no encontraba la suya se iba. Lo que
 * faltaba no era quitarlo: era que la salida —«esto que necesito no está»—
 * estuviera a la vista en vez de al final de la lista. Ahora lo está, y por
 * eso la lista puede volver.
 */
export function FormularioPublicarServicio({
  municipios,
  zonas,
  subcategorias,
  turnstileSiteKey,
}: {
  municipios: MunicipioBasico[]
  zonas: Zona[]
  subcategorias: Subcategoria[]
  turnstileSiteKey: string
}) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [grupo, setGrupo] = useState<GrupoOficio | ''>('')
  // Del catálogo, o escrita a mano. Nunca las dos: elegir una limpia la
  // otra, que es el gemelo en la pantalla del CHECK
  // `solicitudes_servicio_una_subcategoria`.
  const [oficioId, setOficioId] = useState('')
  const [propuesta, setPropuesta] = useState('')
  const [escribiendo, setEscribiendo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [zonaId, setZonaId] = useState('')
  const [zonaTexto, setZonaTexto] = useState('')
  const [urgencia, setUrgencia] = useState<UrgenciaServicio>('esta_semana')
  const [pago, setPago] = useState<CapacidadPago>('puedo_pagar')
  const [nota, setNota] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState<{ codigo: string } | null>(null)

  const zonasDelMunicipio = zonas.filter((z) => z.municipio === municipio)
  const municipioElegido = municipios.find((m) => m.codigo_dane === municipio)
  const errorNota = nota.trim() ? validarNota(nota.trim()) : null
  // Mismo filtro que la nota y el chat: si trae un teléfono o un correo, no
  // se envía y se dice por qué. Solo se comprueba con algo escrito, para no
  // gritarle a nadie por un campo vacío.
  const errorDetalle = detalle.trim().length >= 3 ? validarNota(detalle.trim()) : null
  const delGrupo = subcategorias.filter((sc) => sc.grupo === grupo)
  // Solo con algo escrito: validar lo que la persona no ha escrito es cómo
  // aparecen mensajes de error sobre campos vacíos.
  const errorPropuesta = escribiendo.trim() ? validarSugerencia(escribiendo.trim()) : null
  const hayaSubcategoria = oficioId !== '' || propuesta !== ''

  function elegirCategoria(valor: GrupoOficio) {
    setGrupo(valor)
    // Cambiar de categoría suelta lo de la anterior: un oficio de Belleza
    // colgando de «Arreglos de la casa» no lo acepta ni el servidor.
    setOficioId('')
    setPropuesta('')
    setEscribiendo('')
  }
  const errorZona =
    zonaTexto.trim() && contienePII(zonaTexto)
      ? 'La zona no puede llevar teléfonos ni correos.'
      : null

  // Al menos una: sin ubicación dentro del municipio, nadie sabe si le
  // queda cerca y la solicitud no le sirve a nadie.
  const hayUbicacion = zonaId !== '' || zonaTexto.trim().length >= 2

  // Lo único que cambia entre Cali y el resto es cómo se llama el campo.
  const etiquetaZona = zonasDelMunicipio.length > 0 ? 'Barrio' : 'Barrio o vereda'

  async function enviar() {
    setEnviando(true)
    setError(null)

    // Va por el contrato y no por una ruta de API con una función de
    // PL/pgSQL detrás (ADR 0001). La solicitud cuelga de la cuenta, así que
    // ya no hay token que copiar ni que guardar en este teléfono.
    try {
      const { codigo } = await rpc.servicios.publicarSolicitud({
        grupo: grupo as GrupoOficio,
        oficio_id: oficioId || undefined,
        subcategoria_nueva: propuesta || undefined,
        detalle: detalle.trim() || undefined,
        municipio,
        zona_id: zonaId || undefined,
        zona_texto: zonaTexto.trim() || undefined,
        urgencia,
        capacidad_pago: pago,
        nota: nota.trim() || undefined,
      })
      setListo({ codigo })
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo publicar')
    } finally {
      setEnviando(false)
    }
  }

  if (listo) {
    return (
      <div className="mt-6">
        <Alert>
          <AlertTitle className="font-heading text-2xl font-extrabold tracking-tight">
            Listo. Tu solicitud es la {listo.codigo}.
          </AlertTitle>
          <AlertDescription>
            {/* Ya no hay enlace que guardar: la solicitud cuelga de la
                cuenta (ADR 0006) y se llega a ella desde el perfil. Antes
                perder ese enlace era perder la solicitud y el chat. */}
            <p className="mt-2 text-base">
              La vas a encontrar en tu perfil, con todo lo tuyo. El código sirve
              para decirlo por teléfono si hace falta.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button nativeButton={false} render={<Link href="/mis-solicitudes" />}>
                Ver mis solicitudes
              </Button>
            </div>
            <p className="mt-3 text-base">
              Cuando alguien responda, se abre un chat para acordar hora, lugar y
              precio. No tienes que dar tu teléfono.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Se borra sola a los 15 días, con el chat dentro. Puedes renovarla,
              cerrarla o borrarla antes desde tu perfil.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mt-6">
      {/* Con nombre y no numerados: «Paso 2 de 3» no dice de qué es el 2. */}
      <ol className="riel mb-6 flex gap-1.5 overflow-x-auto text-sm" aria-label="Progreso">
        {['Qué', 'Dónde y cuándo', 'Publicar'].map((nombre, i) => (
          <li key={nombre} className="min-w-0 flex-1">
            <span
              aria-current={i + 1 === paso ? 'step' : undefined}
              className={`block truncate border-t-2 pt-1.5 ${
                i + 1 === paso
                  ? 'border-enlace font-semibold text-foreground'
                  : i + 1 < paso
                    ? 'border-ok text-muted-foreground'
                    : 'border-border text-muted-foreground'
              }`}
            >
              {nombre}
            </span>
          </li>
        ))}
      </ol>

      {paso === 1 && (
        <div className="space-y-4">
          {/* Momento 1: la categoría. Elegida, las doce píldoras colapsan a
              una sola con «Cambiar» — si se quedaran, el paso pasaría de
              doce a veinte y empeoraría justo lo que el ADR 0011 arregló. */}
          {!grupo ? (
            <fieldset>
              <legend className="mb-2 text-base font-medium">
                ¿De qué se trata?
              </legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(GRUPOS).map(([valor, etiqueta]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => elegirCategoria(valor as GrupoOficio)}
                    className="inline-flex min-h-12 items-center rounded-full border border-border bg-card px-4 text-base transition-colors hover:bg-muted"
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex min-h-12 items-center rounded-full border border-enlace bg-secondary px-4 text-base font-semibold text-secondary-foreground">
                  {GRUPOS[grupo]}
                </span>
                <button
                  type="button"
                  onClick={() => elegirCategoria('' as GrupoOficio)}
                  className="text-enlace min-h-12 text-base underline underline-offset-4"
                >
                  Cambiar
                </button>
              </div>

              {/* Momento 2: qué, dentro de esa categoría. */}
              <fieldset>
                <legend className="mb-2 text-base font-medium">
                  ¿Qué necesitas exactamente?
                </legend>
                <div className="flex flex-wrap gap-2">
                  {delGrupo.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      aria-pressed={oficioId === sc.id}
                      onClick={() => {
                        setOficioId(sc.id)
                        setPropuesta('')
                        setEscribiendo('')
                      }}
                      className={`inline-flex min-h-12 items-center rounded-full border px-4 text-base transition-colors ${
                        oficioId === sc.id
                          ? 'border-enlace bg-secondary font-semibold text-secondary-foreground'
                          : 'border-border bg-card hover:bg-muted'
                      }`}
                    >
                      {sc.nombre}
                    </button>
                  ))}
                  {/* Lo escrito se pinta como una más, elegida, con su sello:
                      así se ve que cuenta como respuesta y no como un campo a
                      medio llenar. */}
                  {propuesta && (
                    <button
                      type="button"
                      aria-pressed
                      onClick={() => {
                        setEscribiendo(propuesta)
                        setPropuesta('')
                      }}
                      className="border-enlace bg-secondary text-secondary-foreground inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-base font-semibold"
                    >
                      {propuesta}
                      <span className="font-heading rounded-full bg-accent px-2 py-0.5 text-xs tracking-[0.085em] text-accent-foreground uppercase">
                        Lo revisamos
                      </span>
                    </button>
                  )}
                </div>
              </fieldset>

              {/* ⚠ Siempre a la vista, nunca detrás de un desplegable. Es la
                  salida que le faltaba al ADR 0011, y una salida escondida
                  no es una salida. */}
              {!propuesta && (
                <div className="rounded-2xl bg-card p-3 shadow-canto">
                  <Label htmlFor="propuesta" className="text-base">
                    ¿No encuentras lo tuyo?
                  </Label>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Escríbelo y lo revisamos. Tu solicitud se publica ya.
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="propuesta"
                      value={escribiendo}
                      onChange={(e) => setEscribiendo(e.target.value)}
                      maxLength={60}
                      className="min-w-0 flex-1"
                      placeholder="Cambiar una teja rota"
                    />
                    <Button
                      variant="outline"
                      className="shrink-0"
                      disabled={escribiendo.trim().length < 2 || !!errorPropuesta}
                      onClick={() => {
                        setPropuesta(escribiendo.trim())
                        setOficioId('')
                        setEscribiendo('')
                      }}
                    >
                      Agregar
                    </Button>
                  </div>
                  {errorPropuesta && (
                    <p className="mt-1 text-sm text-destructive">{errorPropuesta}</p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="detalle">Cuéntanos más (opcional)</Label>
                <Input
                  id="detalle"
                  value={detalle}
                  onChange={(e) => setDetalle(e.target.value)}
                  maxLength={80}
                  className="mt-1"
                  placeholder="La pieza de atrás, unos 12 metros"
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  {detalle.trim().length}/80. Sirve para dar contexto: cuánto,
                  dónde, cuándo. Sin teléfonos ni direcciones.
                </p>
                {errorDetalle && (
                  <p className="mt-1 text-sm text-destructive">{errorDetalle}</p>
                )}
              </div>
            </>
          )}

          <p className="text-sm text-muted-foreground">
            ¿Buscas un ingeniero, un médico o un abogado? Esos van en{' '}
            <Link href="/profesionales" className="underline">
              profesionales con matrícula
            </Link>
            .
          </p>

          {/* El detalle ya no bloquea: desde el ADR 0013 lo que identifica
              la solicitud es la subcategoría. */}
          <Button
            className="w-full"
            disabled={!grupo || !hayaSubcategoria || !!errorDetalle}
            onClick={() => setPaso(2)}
          >
            Continuar
          </Button>
        </div>
      )}

      {paso === 2 && (
        <div className="space-y-4">
          <div>
            <Label>¿En qué municipio?</Label>
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
              <ComboboxTrigger aria-label="Municipio" className="mt-1">
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
                    <SelectTrigger aria-label="Comuna" className="mt-1">
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
                <Label htmlFor="s-zona">{etiquetaZona}</Label>
                <Input
                  id="s-zona"
                  value={zonaTexto}
                  onChange={(e) => setZonaTexto(e.target.value)}
                  maxLength={60}
                  placeholder="El barrio, no la dirección"
                  className="mt-1"
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  Con el barrio basta para que alguien sepa si le queda cerca.
                  La dirección se la das después, si decides contratarlo.
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
            <legend className="mb-2 text-base font-medium">¿Para cuándo?</legend>
            <div className="flex flex-wrap gap-2">
              {URGENCIAS.map((u) => (
                <button
                  key={u.valor}
                  type="button"
                  aria-pressed={urgencia === u.valor}
                  onClick={() => setUrgencia(u.valor)}
                  className={`inline-flex min-h-12 items-center rounded-full border px-4 text-base transition-colors ${
                    urgencia === u.valor
                      ? 'border-enlace bg-secondary font-semibold text-secondary-foreground'
                      : 'border-border bg-card hover:bg-muted'
                  }`}
                >
                  {u.etiqueta}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-base font-medium">¿Puedes pagar?</legend>
            {/* La razón va antes de las opciones. Detrás de ellas, quien
                dudaba ya había elegido: sin esto parece un filtro para
                descartar a alguien, y es lo contrario. */}
            <p className="mt-1 mb-2 text-sm text-muted-foreground">
              Sirve para mostrarte primero a quien trabaja gratis o por aporte
              voluntario. No se usa para nada más y nadie puede buscar por esto.
            </p>
            <div className="flex flex-col gap-2">
              {CAPACIDADES_PAGO.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  aria-pressed={pago === c.valor}
                  onClick={() => setPago(c.valor)}
                  className={`inline-flex min-h-12 items-center rounded-full border px-4 text-left text-base transition-colors ${
                    pago === c.valor
                      ? 'border-enlace bg-secondary font-semibold text-secondary-foreground'
                      : 'border-border bg-card hover:bg-muted'
                  }`}
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPaso(1)}>
              Atrás
            </Button>
            <Button
              className="flex-1"
              disabled={municipio === '' || !hayUbicacion || !!errorZona}
              onClick={() => setPaso(3)}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="s-nota">
              ¿Algo más?{' '}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="s-nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={140}
              rows={3}
              placeholder="Son dos pantalones para bajar el ruedo."
              className="mt-1"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              {nota.length}/140. Sin nombres, teléfonos ni direcciones.
            </p>
            {errorNota && <p className="mt-1 text-sm text-destructive">{errorNota}</p>}
          </div>

          {turnstileSiteKey && (
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPaso(2)}>
              Atrás
            </Button>
            <Button
              className="flex-1"
              disabled={enviando || !!errorNota || (!!turnstileSiteKey && !turnstileToken)}
              onClick={enviar}
            >
              {enviando ? 'Publicando…' : 'Publicar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
