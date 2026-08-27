'use client'

import { useState } from 'react'
import Link from 'next/link'

import { rpc } from '@/orpc/cliente'

import { contienePII, validarNota } from '@/lib/validacion'
import { nombreConDepartamento, type MunicipioBasico } from '@/lib/municipios'
import { CAPACIDADES_PAGO, GRUPOS, URGENCIAS } from '@/lib/servicios'
import type { CapacidadPago, Database, UrgenciaServicio } from '@/lib/types'
import type { GrupoOficio } from '@/contrato/servicios'
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
 * ⚠ El primer paso ya NO es el catálogo de oficios (ADR 0011). Eran
 * cuarenta y tantas píldoras, y quien necesitaba algo que no estuviera en
 * la lista —que es la mitad del rebusque— las recorría todas y se iba.
 * Ahora es una categoría de ocho y una línea escrita.
 */
export function FormularioPublicarServicio({
  municipios,
  zonas,
  turnstileSiteKey,
}: {
  municipios: MunicipioBasico[]
  zonas: Zona[]
  turnstileSiteKey: string
}) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [grupo, setGrupo] = useState<GrupoOficio | ''>('')
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
        detalle: detalle.trim(),
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
          <fieldset>
            <legend className="mb-2 text-base font-medium">
              ¿De qué se trata?
            </legend>
            {/* Ocho píldoras, no cuarenta. Caben en una pantalla y se eligen
                de un vistazo; el detalle lo escribe quien pide. */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(GRUPOS).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={grupo === valor}
                  onClick={() => setGrupo(valor as GrupoOficio)}
                  className={`inline-flex min-h-12 items-center rounded-full border px-4 text-base transition-colors ${
                    grupo === valor
                      ? 'border-enlace bg-secondary font-semibold text-secondary-foreground'
                      : 'border-border bg-card hover:bg-muted'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="detalle">¿Qué necesitas? Dilo con tus palabras</Label>
            <Input
              id="detalle"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              maxLength={80}
              className="mt-1"
              placeholder="Que me arreglen la puerta del clóset"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              {detalle.trim().length}/80. Sin teléfonos ni direcciones: quien
              responda te escribe por el chat de aquí.
            </p>
            {errorDetalle && (
              <p className="mt-1 text-sm text-destructive">{errorDetalle}</p>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            ¿Buscas un ingeniero, un médico o un abogado? Esos van en{' '}
            <Link href="/profesionales" className="underline">
              profesionales con matrícula
            </Link>
            .
          </p>

          <Button
            className="w-full"
            disabled={!grupo || detalle.trim().length < 3 || !!errorDetalle}
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
