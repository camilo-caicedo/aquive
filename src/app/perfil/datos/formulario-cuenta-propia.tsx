'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useAviso } from '@/components/avisos'
import { rpc } from '@/orpc/cliente'
import { contienePII } from '@/lib/validacion'
import { nombreConDepartamento, type MunicipioBasico } from '@/lib/municipios'

type Cuenta = {
  nombre_visible: string
  municipios: string[]
  contacto_publico: string | null
  contacto_tipo: 'whatsapp' | 'telefono'
  tipo: 'vecino' | 'servidor' | 'aliado'
}

/**
 * Los datos de la CUENTA, que son otra cosa que los de la ficha.
 *
 * Hasta el ADR 0015 no había dónde tocarlos salvo en `/registro`, el
 * formulario del módulo de insumos, y esta pantalla rebotaba al alta del
 * carné a quien no lo tuviera.
 *
 * ⚠ El sello de cada campo depende del TIPO y no es una constante. Para un
 * `vecino` nada de esto lo publica ninguna vista; para un `servidor` el
 * nombre y el teléfono salen en `servidores_publicos`. Escribir «Privado»
 * fijo sería mentirle a la mitad de la gente.
 *
 * ⚠ Y la acción va en `outline` cuando hay ficha: la barra fija del
 * `MarcoFlujo` ya la ocupa la de la ficha, y una sola acción en lima por
 * pantalla (regla de interfaz 2). Sin ficha, esta es la principal.
 */
export function FormularioCuentaPropia({
  cuenta,
  municipios,
  principal = false,
}: {
  cuenta: Cuenta
  municipios: MunicipioBasico[]
  /** Si es la única acción de la pantalla, va en lima y ancha. */
  principal?: boolean
}) {
  const router = useRouter()
  const avisar = useAviso()

  const [nombre, setNombre] = useState(cuenta.nombre_visible)
  const [municipio, setMunicipio] = useState(cuenta.municipios[0] ?? '')
  const [contacto, setContacto] = useState(cuenta.contacto_publico ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const publica = cuenta.tipo === 'servidor'
  const municipioElegido = municipios.find((m) => m.codigo_dane === municipio)

  const errorNombre =
    nombre.trim().length > 0 && contienePII(nombre)
      ? 'El nombre no puede llevar teléfonos, correos ni cédulas.'
      : null

  const puedeGuardar =
    nombre.trim().length >= 3 &&
    nombre.trim().length <= 60 &&
    municipio !== '' &&
    !errorNombre &&
    (!publica || contacto.trim().length >= 7)

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await rpc.cuentas.guardarMia({
        nombre_visible: nombre.trim(),
        municipios: [municipio],
        contacto_publico: contacto.trim() || null,
        contacto_tipo: cuenta.contacto_tipo,
      })
      avisar('Guardamos los datos de tu cuenta.')
      router.refresh()
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo guardar. Inténtalo otra vez.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="shadow-canto rounded-2xl bg-card p-4">
      <h2 className="font-heading text-xl leading-tight">Tu cuenta</h2>
      <p className="mt-1 text-base text-muted-foreground">
        {publica
          ? 'Tu nombre y tu teléfono salen en tu ficha de profesional con matrícula.'
          : 'Nada de esto se publica. Tu nombre lo ve quien reciba un mensaje tuyo, y el municipio solo sirve para enseñarte lo que hay cerca.'}
      </p>

      <div className="mt-4">
        <Label htmlFor="cuenta-nombre">Cómo te llamamos</Label>
        <Input
          id="cuenta-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={60}
          className="mt-1"
        />
        {errorNombre && (
          <p className="mt-1 text-sm font-medium text-destructive">{errorNombre}</p>
        )}
      </div>

      <div className="mt-4">
        <Label>Tu municipio</Label>
        <Combobox
          items={municipios}
          value={municipioElegido ?? null}
          onValueChange={(m: MunicipioBasico | null) => setMunicipio(m?.codigo_dane ?? '')}
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

      <div className="mt-4">
        <Label htmlFor="cuenta-contacto">
          Teléfono {publica ? '' : '(opcional)'}
        </Label>
        <Input
          id="cuenta-contacto"
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          maxLength={40}
          inputMode="tel"
          autoComplete="tel"
          className="mt-1"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          {publica
            ? 'Es el que sale en tu ficha de profesional: por ahí te escriben.'
            : 'No se publica en ninguna parte. Sirve para que la fundación pueda llamarte si hace falta.'}
        </p>
      </div>

      {error && (
        <p className="mt-4 text-base font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant={principal ? 'default' : 'outline'}
        className="mt-4 w-full"
        disabled={!puedeGuardar || guardando}
        onClick={guardar}
      >
        {guardando ? 'Guardando…' : 'Guardar esta sección'}
      </Button>
    </section>
  )
}
