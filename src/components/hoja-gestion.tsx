'use client'

import type { ReactNode } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HojaAccion } from '@/components/hoja-accion'

/**
 * Las acciones de una fila, agrupadas en una hoja.
 *
 * Existe porque un miembro del equipo podía tener hasta seis botones
 * apilados debajo de su nombre, y ahí «Dar permiso de ver identidades»
 * —que deja leer cédulas— tenía el mismo peso visual que «Hacer
 * coordinador» y estaba a un toque de «Sacar del equipo». Tres cosas de
 * consecuencias muy distintas, del mismo tamaño y en la misma columna.
 *
 * Dentro va en este orden y siempre: permisos como interruptores con su
 * explicación al lado, cambios de papel debajo, y lo destructivo separado
 * por una línea y con confirmación.
 */
export function HojaGestion({
  id,
  titulo,
  resumen,
  permisos,
  papeles,
  destructivo,
}: {
  id: string
  /** De quién o de qué son estas acciones. */
  titulo: string
  /** Una línea de contexto: el estado, el papel actual. */
  resumen?: ReactNode
  /** Interruptores. Cada uno con su explicación. */
  permisos?: ReactNode
  /** Cambios de papel: hacer coordinador, aprobar, suspender. */
  papeles?: ReactNode
  /** Sacar del equipo, borrar. Va separado y con confirmación propia. */
  destructivo?: ReactNode
}) {
  return (
    <HojaAccion
      id={id}
      titulo={titulo}
      disparador={(props) => (
        <Button {...props} variant="outline">
          <Settings2 className="size-5" aria-hidden="true" />
          Gestionar
        </Button>
      )}
    >
      {resumen && <p className="text-base text-muted-foreground">{resumen}</p>}

      {permisos && <div className="space-y-3">{permisos}</div>}

      {papeles && <div className="space-y-2">{papeles}</div>}

      {destructivo && (
        <div className="space-y-2 border-t border-border pt-4">{destructivo}</div>
      )}
    </HojaAccion>
  )
}

/**
 * Un permiso como interruptor, con su explicación al lado.
 *
 * `advertencia` es para los que abren datos de otra persona: ahí no basta
 * con decir qué hace, hay que decir qué se lleva por delante.
 */
export function FilaPermiso({
  etiqueta,
  explicacion,
  advertencia,
  activo,
  onChange,
  disabled,
}: {
  etiqueta: string
  explicacion: ReactNode
  advertencia?: ReactNode
  activo: boolean
  onChange: (valor: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex min-h-16 cursor-pointer items-start gap-3 rounded-xl bg-card p-3 has-checked:bg-secondary">
      <input
        type="checkbox"
        checked={activo}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-6 shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-base font-medium">{etiqueta}</span>
        <span className="block text-sm text-muted-foreground">{explicacion}</span>
        {advertencia && (
          <span className="mt-1 block rounded-lg bg-accent px-2.5 py-1.5 text-sm text-accent-foreground">
            {advertencia}
          </span>
        )}
      </span>
    </label>
  )
}
