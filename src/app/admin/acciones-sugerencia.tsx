'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Merge } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { NOMBRE_GRUPO } from '@/contrato/servicios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { SugerenciaPendiente } from '@/lib/types'

/**
 * Las tres salidas de una sugerencia: fusionar, aprobar o rechazar.
 *
 * La decisión real es «¿esto ya existe con otro nombre?», así que los
 * parecidos van primero y cada uno con su propio botón: si fusionar
 * costara un clic más que aprobar, nadie los usaría y el catálogo se
 * llenaría de sinónimos.
 *
 * Van en terracota tenue y ANTES de la nota, que es donde se decide. Y
 * cuando no hay ninguno se dice, en vez de dejar el hueco: un espacio en
 * blanco no distingue «no busqué» de «busqué y no hay nada».
 *
 * Rechazar deja de ser un `destructive` del mismo tamaño que aprobar: no
 * destruye nada —no crea ni cambia— y es la salida menos frecuente.
 *
 * ⚠ Con el ADR 0013 esto sirve para dos catálogos. Un ítem de insumos se
 * aprueba con lo que traiga; un OFICIO hay que decirle además su categoría
 * y su riesgo, y el riesgo **no viene prellenado**: la regla de producto 7
 * cuelga de esa columna, y un «cuidar a mi sobrino después del colegio»
 * aprobado como bajo porque el formulario traía bajo puesto se salta el
 * filtro entero —teléfono verificado Y referencia confirmada— y sale
 * publicado.
 */
export function AccionesSugerencia({ sugerencia }: { sugerencia: SugerenciaPendiente }) {
  const router = useRouter()
  const esOficio = sugerencia.tipo === 'oficio'

  // El texto se puede corregir antes de aprobar: casi siempre es una tilde
  // o un plural, y obligar a rechazar y esperar a que la persona lo vuelva
  // a escribir es perder la propuesta.
  const [nombre, setNombre] = useState(sugerencia.nombre_propuesto)
  const [grupo, setGrupo] = useState(sugerencia.grupo_sugerido ?? '')
  const [riesgo, setRiesgo] = useState<'bajo' | 'alto' | ''>('')
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cambiado = nombre.trim() !== sugerencia.nombre_propuesto.trim()
  const puedeAprobar =
    nombre.trim().length >= 2 && (!esOficio || (grupo !== '' && riesgo !== ''))

  async function resolver(accion: 'aprobar' | 'rechazar' | 'fusionar', destino?: string) {
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('resolver_sugerencia', {
      p_sugerencia_id: sugerencia.id,
      p_accion: accion,
      p_item_destino: destino ?? null,
      p_nota: nota.trim() || null,
      p_nombre_final: nombre.trim() || null,
      p_grupo: esOficio ? grupo || null : null,
      p_riesgo: esOficio && accion === 'aprobar' ? riesgo || null : null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="mt-3 space-y-3">
      {sugerencia.parecidos.length > 0 ? (
        <div className="rounded-xl bg-accent p-3">
          <p className="text-base font-medium text-accent-foreground">
            Ya existe algo parecido
          </p>
          <div className="mt-2 space-y-2">
            {sugerencia.parecidos.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                className="w-full justify-start"
                disabled={enviando}
                onClick={() => resolver('fusionar', p.id)}
              >
                <Merge className="size-4" aria-hidden="true" />
                Fusionar con «{p.nombre}»
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-base text-muted-foreground">Nada parecido en el catálogo.</p>
      )}

      {/* El texto corregible, con el original a la vista mientras cambia:
          sin eso no hay forma de saber qué escribió la persona. */}
      <div>
        <Label htmlFor={`nombre-${sugerencia.id}`} className="text-sm">
          Cómo va a quedar en el catálogo
        </Label>
        <Input
          id={`nombre-${sugerencia.id}`}
          className="mt-1"
          maxLength={60}
          value={nombre}
          disabled={enviando}
          onChange={(e) => setNombre(e.target.value)}
        />
        {cambiado && (
          <p className="mt-1 text-sm text-muted-foreground">
            Escribió «{sugerencia.nombre_propuesto}».
          </p>
        )}
      </div>

      {esOficio && (
        <>
          <div>
            <Label htmlFor={`grupo-${sugerencia.id}`} className="text-sm">
              Categoría
            </Label>
            {/* Nativo y no el Select de la aplicación: esta pantalla la usa
                una persona en un escritorio, y aquí lo que importa es que
                las doce se vean sin abrir nada. */}
            <select
              id={`grupo-${sugerencia.id}`}
              className="mt-1 min-h-12 w-full rounded-xl bg-muted px-3 text-base"
              value={grupo}
              disabled={enviando}
              onChange={(e) => setGrupo(e.target.value)}
            >
              <option value="">Elige una…</option>
              {Object.entries(NOMBRE_GRUPO).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Riesgo</legend>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <strong className="font-semibold">Alto</strong> es quedar a solas
              con alguien que no puede defenderse: un menor, una persona
              enferma, un pasajero. No significa peligroso de hacer. Un oficio
              alto no se publica sin teléfono verificado y una referencia
              confirmada.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { valor: 'bajo', etiqueta: 'Riesgo bajo' },
                  { valor: 'alto', etiqueta: 'Riesgo alto' },
                ] as const
              ).map((r) => (
                <button
                  key={r.valor}
                  type="button"
                  aria-pressed={riesgo === r.valor}
                  disabled={enviando}
                  onClick={() => setRiesgo(r.valor)}
                  className={`inline-flex min-h-12 items-center rounded-full border px-4 text-base transition-colors ${
                    riesgo === r.valor
                      ? 'border-enlace bg-secondary font-semibold text-secondary-foreground'
                      : 'border-border bg-card hover:bg-muted'
                  }`}
                >
                  {r.etiqueta}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <div>
        <Label htmlFor={`nota-${sugerencia.id}`} className="text-sm">
          Nota (opcional)
        </Label>
        <Input
          id={`nota-${sugerencia.id}`}
          className="mt-1"
          maxLength={300}
          value={nota}
          disabled={enviando}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Por qué tomaste esta decisión"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="flex-1"
          disabled={enviando || !puedeAprobar}
          onClick={() => resolver('aprobar')}
        >
          {enviando ? 'Guardando…' : 'Aprobar nuevo'}
        </Button>
        <Button variant="ghost" disabled={enviando} onClick={() => resolver('rechazar')}>
          Rechazar
        </Button>
      </div>

      {/* Por qué no se puede aprobar todavía. Un botón apagado sin motivo
          se lee como que la pantalla está rota. */}
      {esOficio && !puedeAprobar && (
        <p className="text-sm text-muted-foreground">
          Para aprobarlo elige su categoría y su riesgo.
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
