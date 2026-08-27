'use client'

import { useState } from 'react'
import { Copy, Info } from 'lucide-react'

import { rpc } from '@/orpc/cliente'
import { Button } from '@/components/ui/button'
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
import { contienePII } from '@/lib/validacion'
import type { MunicipioBasico } from '@/lib/municipios'

type Tipo = 'vecino' | 'ofertador' | 'servidor'

const TIPOS: { valor: Tipo; etiqueta: string; ayuda: string }[] = [
  {
    valor: 'vecino',
    etiqueta: 'Solo va a pedir',
    ayuda: 'No publica nada: ni nombre, ni teléfono, ni ficha. No hace falta su número.',
  },
  {
    valor: 'servidor',
    etiqueta: 'Va a ofrecer su trabajo',
    ayuda: 'Su nombre y su teléfono van a ser públicos en su ficha.',
  },
  {
    valor: 'ofertador',
    etiqueta: 'Va a ofrecer ayuda',
    ayuda: 'Responde solicitudes de insumos. Su contacto es público.',
  },
]

/**
 * Dar de alta a alguien que no tiene cuenta de Google (ADR 0006).
 *
 * ⚠ El guion de leer en voz alta viene de `panel-proveedores.tsx`, y no es
 * decoración: quien llena esto está publicando datos de OTRA persona, que
 * está enfrente y no está viendo la pantalla. Esa persona tiene que
 * autorizar sabiendo qué va a quedar público, y por eso hay una casilla que
 * dice que se le leyó.
 *
 * ⚠ El código aparece UNA vez. Se guarda solo su `sha256`, así que cerrar
 * sin copiarlo obliga a regenerarlo — y regenerarlo invalida el anterior.
 * Se avisa antes de guardar, no después.
 */
export function FormularioCuenta({ municipios }: { municipios: MunicipioBasico[] }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<Tipo>('vecino')
  const [telefono, setTelefono] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [lei, setLei] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El código en claro. Vive solo aquí y desaparece al recargar.
  const [listo, setListo] = useState<{ nombre: string; url: string } | null>(null)

  const publica = tipo !== 'vecino'
  const municipioElegido = municipios.find((m) => m.codigo_dane === municipio)
  const errorNombre =
    nombre.trim() && contienePII(nombre)
      ? 'El nombre no puede llevar teléfonos, correos ni cédulas.'
      : null

  const puede =
    nombre.trim().length >= 3 &&
    !errorNombre &&
    municipio !== '' &&
    (!publica || /^[0-9+()\- ]{7,20}$/.test(telefono.trim())) &&
    lei &&
    !guardando

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const { codigo } = await rpc.cuentas.crear({
        nombre_visible: nombre.trim(),
        contacto_publico: publica ? telefono.trim() : undefined,
        contacto_tipo: publica ? 'whatsapp' : undefined,
        municipios: [municipio],
        tipo,
      })
      setListo({
        nombre: nombre.trim(),
        url: `${window.location.origin}/entrar/${encodeURIComponent(codigo)}`,
      })
      setAbierto(false)
      setNombre('')
      setTelefono('')
      setLei(false)
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo. Inténtalo otra vez.')
    } finally {
      setGuardando(false)
    }
  }

  if (listo) {
    return (
      <div className="shadow-cartel-verde rounded-2xl bg-card p-4">
        <h2 className="font-heading text-2xl leading-tight">
          Listo. Esta es la puerta de {listo.nombre}.
        </h2>
        <p className="mt-2 text-base">
          Entrégale este enlace en un papel o por WhatsApp. Es lo único que le
          permite entrar, y <strong>no se puede volver a ver</strong>: si lo
          pierde, hay que darle uno nuevo, y el nuevo deja al viejo sin servir.
        </p>
        <p className="mt-3 rounded-xl bg-background p-3 font-mono text-sm break-all">
          {listo.url}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => navigator.clipboard.writeText(listo.url)}>
            <Copy className="size-4" aria-hidden="true" />
            Copiar el enlace
          </Button>
          <Button variant="outline" onClick={() => setListo(null)}>
            Dar de alta a alguien más
          </Button>
        </div>
      </div>
    )
  }

  if (!abierto) {
    return <Button onClick={() => setAbierto(true)}>Dar de alta a alguien</Button>
  }

  return (
    <div className="shadow-canto space-y-4 rounded-2xl bg-card p-4">
      {/* Para leer en voz alta, con la persona enfrente. */}
      <p className="flex items-start gap-2 rounded-xl bg-secondary p-3 text-base text-secondary-foreground">
        <Info className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
        <span>
          Estás creando la cuenta de otra persona. Léele en voz alta qué va a
          quedar público antes de guardar, y no le pidas nada que no esté aquí.
        </span>
      </p>

      <fieldset>
        <legend className="text-base font-medium">¿Qué va a hacer?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              aria-pressed={tipo === t.valor}
              onClick={() => setTipo(t.valor)}
              className={`inline-flex min-h-12 items-center rounded-full px-4 text-base transition-colors ${
                tipo === t.valor
                  ? 'bg-foreground font-semibold text-background'
                  : 'shadow-canto bg-card hover:bg-muted'
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {TIPOS.find((t) => t.valor === tipo)?.ayuda}
        </p>
      </fieldset>

      <div>
        <label htmlFor="c-nombre" className="text-base font-medium">
          Cómo quiere que la llamen
        </label>
        <input
          id="c-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={60}
          className="bg-card border border-input focus-visible:ring-ring mt-1 min-h-12 w-full rounded-full px-4 text-base focus-visible:ring-2 focus-visible:outline-none"
        />
        {errorNombre && (
          <p className="mt-1 text-sm text-muted-foreground">{errorNombre}</p>
        )}
      </div>

      {publica && (
        <div>
          <label htmlFor="c-telefono" className="text-base font-medium">
            Teléfono
          </label>
          <input
            id="c-telefono"
            type="tel"
            inputMode="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            maxLength={20}
            className="bg-card border border-input focus-visible:ring-ring mt-1 min-h-12 w-full rounded-full px-4 text-base focus-visible:ring-2 focus-visible:outline-none"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Va a ser público. Nace sin verificar: alguien tiene que llamar a
            este número y marcarlo (regla de producto 6).
          </p>
        </div>
      )}

      <div>
        <span className="text-base font-medium">¿En qué municipio?</span>
        {/* El mismo Combobox controlado que usa publicar un servicio, y no
            `SelectFiltro`: aquel existe para vivir dentro de un formulario
            GET y su valor solo sale por un campo oculto con `name`. */}
        <Combobox
          items={municipios}
          value={municipioElegido ?? null}
          onValueChange={(m: MunicipioBasico | null) =>
            setMunicipio(m?.codigo_dane ?? '')
          }
          itemToStringLabel={(m: MunicipioBasico) => m.nombre}
          isItemEqualToValue={(a: MunicipioBasico, b: MunicipioBasico) =>
            a.codigo_dane === b.codigo_dane
          }
        >
          <ComboboxTrigger aria-label="Municipio" className="mt-1">
            <ComboboxValue placeholder="Busca el municipio" />
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxInput showTrigger={false} placeholder="Escribe para buscar" />
            <ComboboxEmpty>No encontramos ese lugar.</ComboboxEmpty>
            <ComboboxList>
              {(m: MunicipioBasico) => (
                <ComboboxItem key={m.codigo_dane} value={m}>
                  <span className="flex min-w-0 flex-col">
                    <span>{m.nombre}</span>
                    {m.departamento && (
                      <span className="text-sm text-muted-foreground">
                        {m.departamento}
                      </span>
                    )}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={lei}
          onChange={(e) => setLei(e.target.checked)}
          className="mt-1 size-5 shrink-0"
        />
        <span className="text-base">
          Le leí en voz alta qué va a quedar público y me dijo que sí.
        </span>
      </label>

      {error && (
        <p className="bg-accent text-accent-foreground rounded-2xl p-4 text-base">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button disabled={!puede} onClick={guardar}>
          {guardando ? 'Creando…' : 'Crear la cuenta'}
        </Button>
        <Button variant="outline" onClick={() => setAbierto(false)}>
          Dejarlo
        </Button>
      </div>
    </div>
  )
}
