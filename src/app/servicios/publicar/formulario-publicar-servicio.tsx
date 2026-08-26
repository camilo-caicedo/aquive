'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy } from 'lucide-react'
import { contienePII, validarNota } from '@/lib/validacion'
import { nombreConDepartamento, type MunicipioBasico } from '@/lib/municipios'
import { CAPACIDADES_PAGO, GRUPOS, URGENCIAS } from '@/lib/servicios'
import type { CapacidadPago, Database, UrgenciaServicio } from '@/lib/types'
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

type Oficio = Database['public']['Tables']['catalogo_oficios']['Row']
type Zona = Database['public']['Tables']['zonas']['Row']

/**
 * Tres pantallas, como manda la accesibilidad de CLAUDE.md: qué necesito,
 * dónde y cuándo, y enviar. Ni una más.
 */
export function FormularioPublicarServicio({
  municipios,
  oficios,
  zonas,
  turnstileSiteKey,
}: {
  municipios: MunicipioBasico[]
  oficios: Oficio[]
  zonas: Zona[]
  turnstileSiteKey: string
}) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [oficioId, setOficioId] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [zonaId, setZonaId] = useState('')
  const [zonaTexto, setZonaTexto] = useState('')
  const [urgencia, setUrgencia] = useState<UrgenciaServicio>('esta_semana')
  const [pago, setPago] = useState<CapacidadPago>('puedo_pagar')
  const [nota, setNota] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState<{ codigo: string; url: string } | null>(null)

  const zonasDelMunicipio = zonas.filter((z) => z.municipio === municipio)
  const municipioElegido = municipios.find((m) => m.codigo_dane === municipio)
  const errorNota = nota.trim() ? validarNota(nota.trim()) : null
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

    const respuesta = await fetch('/api/servicios/solicitudes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oficio_id: oficioId,
        municipio,
        zona_id: zonaId || null,
        zona_texto: zonaTexto.trim() || null,
        urgencia,
        capacidad_pago: pago,
        nota: nota.trim() || null,
        turnstileToken,
      }),
    })

    const datos = await respuesta.json()
    if (!respuesta.ok) {
      setError(datos.error ?? 'No se pudo publicar')
      setEnviando(false)
      return
    }

    // El token se guarda en localStorage además de mostrarse, igual que
    // hace `/publicar`: si la persona cierra sin copiarlo, al menos desde
    // este teléfono puede volver.
    try {
      const previas = JSON.parse(localStorage.getItem('aquive_servicios') ?? '[]')
      localStorage.setItem(
        'aquive_servicios',
        JSON.stringify([
          { codigo: datos.codigo, token: datos.token, fecha: Date.now() },
          ...previas,
        ])
      )
    } catch {
      // Si el navegador no deja escribir, no pasa nada: el enlace está en
      // pantalla y es lo que de verdad importa.
    }

    setListo({
      codigo: datos.codigo,
      url: `${window.location.origin}/servicios/solicitud/${datos.token}`,
    })
    setEnviando(false)
  }

  if (listo) {
    return (
      <div className="mt-6">
        <Alert>
          <AlertTitle className="font-heading text-2xl font-extrabold tracking-tight">
            Listo. Tu solicitud es la {listo.codigo}.
          </AlertTitle>
          <AlertDescription>
            <p className="mt-2 text-base">
              Guarda este enlace. Es la única forma de volver a ver quién te
              respondió, y no lo podemos recuperar: no guardamos de quién es.
            </p>
            <p className="mt-2 break-all font-mono text-sm">{listo.url}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(listo.url)}
              >
                <Copy className="size-4" aria-hidden="true" />
                Copiar enlace
              </Button>
              <Button nativeButton={false} render={<Link href={listo.url} />}>
                Ver mi solicitud
              </Button>
            </div>
            <p className="mt-3 text-base">
              Cuando alguien responda, se abre un chat en ese mismo enlace para
              acordar hora, lugar y precio. No tienes que dar tu teléfono.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Se borra sola a los 15 días, con el chat dentro. Puedes renovarla,
              cerrarla o borrarla antes desde ese enlace.
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
            <legend className="mb-2 text-base font-medium">¿Qué necesitas?</legend>
            <div className="space-y-3">
              {Object.entries(GRUPOS).map(([grupo, etiqueta]) => {
                const delGrupo = oficios.filter((o) => o.grupo === grupo)
                if (delGrupo.length === 0) return null
                return (
                  <div key={grupo}>
                    <p className="text-sm font-medium text-muted-foreground">{etiqueta}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {delGrupo.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          aria-pressed={oficioId === o.id}
                          onClick={() => setOficioId(o.id)}
                          className={`inline-flex min-h-12 items-center rounded-full border px-4 text-base transition-colors ${
                            oficioId === o.id
                              ? 'border-enlace bg-secondary font-semibold text-secondary-foreground'
                              : 'border-border bg-card hover:bg-muted'
                          }`}
                        >
                          {o.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </fieldset>

          <p className="text-sm text-muted-foreground">
            ¿Buscas un ingeniero, un médico o un abogado? Esos van en{' '}
            <Link href="/profesionales" className="underline">
              profesionales con matrícula
            </Link>
            .
          </p>

          <Button className="w-full" disabled={!oficioId} onClick={() => setPaso(2)}>
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
