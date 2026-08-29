'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { MarcoFlujo } from '@/components/marco-flujo'
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
import { rpc } from '@/orpc/cliente'
import { recogerDestino } from '@/lib/destino'
import { contienePII } from '@/lib/validacion'
import { nombreConDepartamento, type MunicipioBasico } from '@/lib/municipios'

/**
 * Los dos campos con los que se abre una cuenta.
 *
 * Sin barra de progreso a propósito: `MarcoFlujo` la dibuja si le pasas
 * `pasos`, y un asistente de un solo paso con barra de progreso miente sobre
 * lo que falta.
 */
export function FormularioEmpezar({ municipios }: { municipios: MunicipioBasico[] }) {
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const municipioElegido = municipios.find((m) => m.codigo_dane === municipio)

  // El mismo filtro que el servidor, dicho antes de enviar. El servidor lo
  // vuelve a comprobar: esto es para no hacer ir y volver un formulario que ya
  // se sabe que no pasa.
  const errorNombre =
    nombre.trim().length > 0 && contienePII(nombre)
      ? 'El nombre no puede llevar teléfonos, correos ni cédulas.'
      : null

  const puedeGuardar =
    nombre.trim().length >= 3 && nombre.trim().length <= 60 && municipio !== '' && !errorNombre

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await rpc.cuentas.abrir({
        nombre_visible: nombre.trim(),
        municipios: [municipio],
      })

      // ⚠ El destino se recoge AQUÍ, después de que exista la fila de
      // `perfiles`, y no en un `VueltaAlDestino` montado en la pantalla.
      //
      // Así estaba en `/registro`: el componente hacía `router.replace` al
      // montar, o sea antes de que nadie hubiera creado nada. El recorrido
      // real era «Ofrezco mi trabajo» → `PuertaCerrada` guarda el destino →
      // Google → callback → sin perfil → `/registro` → salto inmediato a
      // `/servicios/soy-proveedor` → `guardar_proveedor` inserta
      // `perfil_id = auth.uid()` sin fila en `perfiles` → violación de llave
      // foránea en pantalla, sin nada que explicar.
      //
      // No hay aviso al terminar: la pantalla siguiente ES la confirmación, y
      // un «Listo» encima es ruido (regla de interfaz 11).
      const destino = recogerDestino()
      router.push(destino ?? '/inicio')
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      // No se va solo: un error que desaparece a los cuatro segundos obliga a
      // repetir la acción para volver a leerlo.
      setError(motivo ?? 'No se pudo abrir tu cuenta. Inténtalo otra vez.')
      setGuardando(false)
    }
  }

  return (
    <MarcoFlujo
      titulo="Tu cuenta"
      volver="/inicio"
      accion={
        <Button
          type="button"
          className="w-full"
          disabled={!puedeGuardar || guardando}
          onClick={guardar}
        >
          {guardando ? 'Abriendo…' : 'Abrir mi cuenta'}
        </Button>
      }
    >
      <p className="text-base text-muted-foreground">
        Dos cosas y ya estás dentro. No hace falta que ofrezcas nada: la cuenta
        sirve igual para buscar, para pedir y para escribir.
      </p>

      <div className="mt-6">
        <Label htmlFor="nombre">¿Cómo te llamamos?</Label>
        <Input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={60}
          autoComplete="name"
          className="mt-1"
          placeholder="Tu nombre o como te conocen"
          aria-describedby="ayuda-nombre"
        />
        {/* La verdad, y no «será público»: para una cuenta que no publica nada
            este nombre no lo ve nadie más que la persona a la que le escribas. */}
        <p id="ayuda-nombre" className="mt-1 text-sm text-muted-foreground">
          Es lo que ve quien reciba tu primer mensaje. No sale en ninguna lista
          mientras no publiques algo.
        </p>
        {errorNombre && (
          <p className="mt-1 text-sm font-medium text-destructive">{errorNombre}</p>
        )}
      </div>

      <div className="mt-5">
        <Label>¿En qué municipio estás?</Label>
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
        <p className="mt-1 text-sm text-muted-foreground">
          Sirve para enseñarte lo que hay cerca. Lo puedes cambiar cuando
          quieras desde tu perfil.
        </p>
      </div>

      {error && (
        <p className="mt-5 text-base font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        De tu cuenta de Google guardamos solo un identificador. El correo se
        descarta y no se guarda en ninguna parte.
      </p>
    </MarcoFlujo>
  )
}
