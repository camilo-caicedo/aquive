'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'

import { rpc } from '@/orpc/cliente'
import type { Movimiento } from '@/contrato/acopios'
import type { Database } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useHidratado } from '@/components/hidratado'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Item = Database['public']['Tables']['catalogo_items']['Row']

/**
 * Lo que entra y lo que sale del centro. ADR 0008, decisión 2.
 *
 * ⚠ Esta pantalla **no existía**. `entregas` llevaba desde ese ADR sin que
 * ninguna pantalla, procedimiento ni función la escribiera o la leyera —cero
 * filas—, mientras «Cómo funciona» le prometía a la gente que «en el acopio,
 * registra qué entregaste».
 *
 * ⚠ De aquí no sale ni entra un dato personal: ítem, cantidad y municipio.
 * Ni quién lo trajo, ni quién se lo llevó, ni para quién era. Es lo que
 * permite que `entregas` sobreviva al borrado de todo lo demás (regla de
 * producto 3), y por eso el formulario ni siquiera tiene dónde escribirlo.
 */
export function PanelEntregas({
  organizacionId,
  municipios,
  items,
  movimientos,
}: {
  organizacionId: string
  municipios: { codigo_dane: string; nombre: string }[]
  items: Item[]
  movimientos: Movimiento[]
}) {
  const router = useRouter()
  const hidratado = useHidratado()

  const [direccion, setDireccion] = useState<'entra' | 'sale'>('entra')
  const [itemId, setItemId] = useState('')
  const [sugerencia, setSugerencia] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [municipio, setMunicipio] = useState(municipios[0]?.codigo_dane ?? '')
  const [codigo, setCodigo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cantidadNum = Number(cantidad)
  const puede =
    (itemId !== '' || sugerencia.trim().length >= 2) &&
    cantidadNum > 0 &&
    cantidadNum <= 9999 &&
    municipio !== '' &&
    !guardando

  async function registrar() {
    if (!puede) return
    setGuardando(true)
    setError(null)
    try {
      await rpc.acopios.registrarMovimiento({
        organizacion_id: organizacionId,
        direccion,
        item_id: itemId || undefined,
        sugerencia: itemId ? undefined : sugerencia.trim(),
        cantidad: cantidadNum,
        municipio,
        solicitud_codigo: codigo.trim() || undefined,
      })
      setItemId('')
      setSugerencia('')
      setCantidad('')
      setCodigo('')
      router.refresh()
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo registrar. Inténtalo otra vez.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section>
      <h2 className="font-heading mt-6 text-2xl">Lo que entra y lo que sale</h2>
      <p className="mt-1 text-base text-muted-foreground">
        Se anota qué y cuánto, y nada de quién. Ni el nombre de quien lo trajo
        ni el de quien se lo llevó: este registro sobrevive al borrado de todo
        lo demás, y solo puede hacerlo si no lleva datos de nadie.
      </p>

      <div className="shadow-canto mt-4 rounded-2xl bg-card p-4">
        <fieldset>
          <legend className="mb-2 text-base font-medium">¿Entra o sale?</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { valor: 'entra', etiqueta: 'Entra', Icono: ArrowDownToLine },
                { valor: 'sale', etiqueta: 'Sale', Icono: ArrowUpFromLine },
              ] as const
            ).map((d) => (
              <button
                key={d.valor}
                type="button"
                aria-pressed={direccion === d.valor}
                onClick={() => setDireccion(d.valor)}
                className={`inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-base transition-colors ${
                  direccion === d.valor
                    ? 'border-enlace bg-secondary font-semibold text-secondary-foreground'
                    : 'border-border bg-card hover:bg-muted'
                }`}
              >
                <d.Icono className="size-4" aria-hidden="true" />
                {d.etiqueta}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <Label htmlFor="e-item">Qué</Label>
          <Select value={itemId} onValueChange={(v) => setItemId(v ?? '')}>
            <SelectTrigger id="e-item" className="mt-1">
              <SelectValue placeholder="Del catálogo…">
                {(v: string) => items.find((i) => i.id === v)?.nombre ?? 'Del catálogo…'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Del catálogo…</SelectItem>
              {items.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {itemId === '' && (
            <>
              <Input
                value={sugerencia}
                onChange={(e) => setSugerencia(e.target.value)}
                maxLength={60}
                className="mt-2"
                aria-label="Escribir qué es"
                placeholder="…o escríbelo: «cobijas de bebé»"
              />
              <p className="mt-1 text-sm text-muted-foreground">
                Lo que escribas se le propone al catálogo, y lo revisa un
                administrador antes de que entre.
              </p>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="w-full min-w-0 sm:flex-1">
            <Label htmlFor="e-cantidad">Cuánto</Label>
            <Input
              id="e-cantidad"
              type="number"
              inputMode="decimal"
              min={1}
              max={9999}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="mt-1"
              placeholder="12"
            />
          </div>
          <div className="w-full min-w-0 sm:flex-1">
            <Label htmlFor="e-municipio">Municipio</Label>
            <Select value={municipio} onValueChange={(v) => setMunicipio(v ?? '')}>
              <SelectTrigger id="e-municipio" className="mt-1">
                <SelectValue placeholder="Elige uno">
                  {(v: string) =>
                    municipios.find((m) => m.codigo_dane === v)?.nombre ?? 'Elige uno'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {municipios.map((m) => (
                  <SelectItem key={m.codigo_dane} value={m.codigo_dane}>
                    {m.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="e-codigo">Código de la solicitud (opcional)</Label>
          <Input
            id="e-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            maxLength={12}
            className="mt-1 font-mono"
            placeholder="ABCD12"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Solo si esto responde a una solicitud concreta. La mayoría de lo
            que entra y sale no responde a ninguna.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button className="mt-4 w-full" disabled={!puede} onClick={registrar}>
          {guardando ? 'Anotando…' : 'Anotar'}
        </Button>
      </div>

      <h3 className="font-heading mt-8 text-xl">Últimos movimientos</h3>
      {movimientos.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-base text-muted-foreground">
          Todavía no has anotado nada.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {movimientos.map((m) => (
            <li
              key={m.id}
              className="shadow-canto flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-card p-3"
            >
              <span className="min-w-0 text-base">
                {/* La dirección va como palabra, no como color: es el dato
                    que cambia qué significa la fila. */}
                <span className="font-semibold">
                  {m.direccion === 'entra' ? 'Entró' : 'Salió'}
                </span>{' '}
                {m.cantidad} {m.unidad} · {m.nombre}
                {m.solicitud_codigo && (
                  <span className="font-mono text-sm text-muted-foreground">
                    {' '}
                    · {m.solicitud_codigo}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">
                {hidratado ? new Date(m.recibido_at).toLocaleDateString('es-CO') : ' '}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
