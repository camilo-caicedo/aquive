'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { contienePII } from '@/lib/validacion'
import {
  CONSENTIMIENTO_REFERENCIA_VERSION,
  RESPONSABLE_SERVICIOS,
  CORREO_HABEAS_DATA_SERVICIOS,
} from '@/lib/config'
import type { Database, EstadoReferencia } from '@/lib/types'
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

type Oficio = Database['public']['Tables']['catalogo_oficios']['Row']

export interface MiReferencia {
  id: string
  estado: EstadoReferencia
  oficio_id: string | null
  oficio_nombre: string | null
  creada_at: string
  revisada_at: string | null
}

const ESTADOS: Record<EstadoReferencia, string> = {
  pendiente: 'Todavía no la hemos llamado',
  confirmada: 'Confirmó que le prestaste el servicio',
  no_contesta: 'No contestó',
  rechazada: 'Dijo que no',
}

/** El sello corto que va al lado. Relleno + palabra: el color nunca informa
 *  solo (regla 9), y salvia y amarillo pálido son fondo, no letra. */
const SELLO: Record<EstadoReferencia, { texto: string; clase: string }> = {
  pendiente: { texto: 'Pendiente', clase: 'bg-accent text-accent-foreground' },
  confirmada: { texto: 'Confirmada', clase: 'bg-ok-suave text-foreground' },
  no_contesta: { texto: 'Sin respuesta', clase: 'bg-muted text-foreground' },
  rechazada: { texto: 'Rechazada', clase: 'bg-muted text-foreground' },
}

/**
 * Las referencias, del lado de quien las da.
 *
 * Guarda el dato personal de alguien que no está aquí, así que la
 * pantalla hace dos cosas que no son adorno: pide una declaración
 * explícita de que se le pidió permiso, y le da al proveedor el texto
 * exacto para reenviarle a esa persona. Sin eso, «obtuve autorización»
 * no significa nada.
 *
 * Lo que se guardó no se devuelve: el proveedor sabe a quién puso, y
 * descifrarlo para él obligaría a auditar también esa lectura.
 */
export function CamposReferencia({
  referencias,
  oficios,
  token,
}: {
  referencias: MiReferencia[]
  oficios: Oficio[]
  token?: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [oficioId, setOficioId] = useState('')
  const [declaro, setDeclaro] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errorNombre =
    nombre.trim() && contienePII(nombre)
      ? 'En el nombre no va el teléfono: va en su propio campo.'
      : null

  const puedeGuardar =
    nombre.trim().length >= 3 &&
    /^[0-9+()\- ]{7,20}$/.test(telefono.trim()) &&
    !errorNombre &&
    declaro &&
    !guardando

  async function agregar() {
    if (!puedeGuardar) return
    setGuardando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('crear_referencia', {
      p_nombre: nombre.trim(),
      p_telefono: telefono.trim(),
      p_oficio_id: oficioId || null,
      p_consentimiento_version: CONSENTIMIENTO_REFERENCIA_VERSION,
      p_token: token ?? null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setGuardando(false)
      return
    }

    setNombre('')
    setTelefono('')
    setOficioId('')
    setDeclaro(false)
    setAbierto(false)
    setGuardando(false)
    router.refresh()
  }

  async function borrar(id: string) {
    if (!confirm('¿Seguro? Se borra el contacto de esa persona.')) return
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('borrar_referencia', {
      p_id: id,
      p_token: token ?? null,
    })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    router.refresh()
  }

  return (
    <section>
      <h2 className="font-heading text-2xl">Quién puede responder por tu trabajo</h2>
      <p className="mt-1 text-base text-muted-foreground">
        Da el contacto de un cliente al que ya le trabajaste.{' '}
        {RESPONSABLE_SERVICIOS} lo llama una vez para confirmarlo. Ese dato
        queda cifrado, <strong>no aparece en tu ficha ni en ninguna parte</strong>{' '}
        y se borra cuando borres la tuya. Máximo tres.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {referencias.length > 0 && (
        <ul className="mt-3 space-y-2">
          {referencias.map((r) => (
            <li
              key={r.id}
              className="shadow-canto flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-3"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-base">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${SELLO[r.estado].clase}`}
                  >
                    {SELLO[r.estado].texto}
                  </span>
                  <span>{ESTADOS[r.estado]}</span>
                </p>
                {r.oficio_nombre && (
                  <p className="mt-1 text-base text-muted-foreground">{r.oficio_nombre}</p>
                )}
              </div>
              <Button variant="ghost" onClick={() => borrar(r.id)}>
                <Trash2 className="size-4" aria-hidden="true" />
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}

      {referencias.length >= 3 ? (
        <p className="mt-3 text-base text-muted-foreground">
          Ya tienes tres. Quita una si quieres cambiarla.
        </p>
      ) : !abierto ? (
        <Button variant="outline" className="mt-3" onClick={() => setAbierto(true)}>
          Agregar una referencia
        </Button>
      ) : (
        <div className="mt-3 space-y-4 rounded-2xl bg-card p-4 shadow-canto">
          <div>
            <Label htmlFor="ref-nombre">Nombre de tu cliente</Label>
            <Input
              id="ref-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              className="mt-1"
            />
            {errorNombre && <p className="mt-1 text-sm text-destructive">{errorNombre}</p>}
          </div>

          <div>
            <Label htmlFor="ref-telefono">Su teléfono</Label>
            <Input
              id="ref-telefono"
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              maxLength={20}
              className="mt-1"
            />
          </div>

          {oficios.length > 0 && (
            <div>
              <Label>¿Qué le hiciste?</Label>
              <Select value={oficioId} onValueChange={(v) => setOficioId(v ?? '')}>
                <SelectTrigger aria-label="Oficio de la referencia" className="mt-1">
                  <SelectValue placeholder="Sin especificar">
                    {(v: string) =>
                      oficios.find((o) => o.id === v)?.nombre ?? 'Sin especificar'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin especificar</SelectItem>
                  {oficios.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* El texto que hay que reenviarle a esa persona. Va aquí, entero
              y copiable, porque el titular no puede leer nada de esta
              pantalla: es la única forma de que se entere de qué se guardó
              de él y de cómo pedir que lo borren. */}
          {/* Crema dentro de la tarjeta blanca, que es como se rellenan
              aquí los bloques de texto (ADR 0002). */}
          <div className="rounded-2xl bg-background p-3">
            <p className="font-heading text-xs tracking-[0.085em] uppercase text-muted-foreground">
              Mándale esto a tu cliente, tal cual
            </p>
            <p className="mt-2 text-base">
              «Te puse como referencia de mi trabajo en AquíVe, el directorio de
              servicios de {RESPONSABLE_SERVICIOS}. Eso significa que alguien de
              la fundación te puede llamar una vez para preguntarte si te presté
              el servicio. Tu nombre y tu teléfono quedan guardados cifrados, no
              aparecen en internet, nadie más los ve y se borran cuando yo borre
              mi ficha. Si no quieres, dime y te quito: no pasa nada. Para
              pedirlo directamente pueden escribir a {CORREO_HABEAS_DATA_SERVICIOS}.»
            </p>
          </div>

          <label className="flex items-start gap-3 text-base">
            <input
              type="checkbox"
              checked={declaro}
              onChange={(e) => setDeclaro(e.target.checked)}
              className="mt-1 size-5 shrink-0"
            />
            <span>
              Le pedí permiso a esta persona para dar su nombre y su teléfono
              como referencia, y aceptó.
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button onClick={agregar} disabled={!puedeGuardar}>
              {guardando ? 'Guardando…' : 'Agregar'}
            </Button>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={guardando}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
