'use client'

import Link from 'next/link'
import { FECHA_LEGALES } from '@/lib/config'
import { validarTelefono } from '@/lib/validacion'
import {
  AVISO_ACOMPANAMIENTO_DATOS,
  AVISO_ACOMPANAMIENTO_SIN_VUELTA,
  type AliadoDelMunicipio,
} from '@/lib/acompanamiento'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
/**
 * Lo que hace falta para activar el acompañamiento, en un solo objeto.
 *
 * ⚠ Ya no lleva documento. La plataforma dejó de pedir y de guardar
 * números de cédula el 20 de agosto de 2026: la verificación de identidad
 * la hace la fundación en persona, mirando el documento en su punto, y no
 * queda ninguna copia por aquí. Lo que se guarda es lo que hace falta para
 * coordinar una entrega —un nombre y, si la persona quiere, un teléfono—
 * y sigue cifrado con llave del Vault. Ver v3-v1.
 */
export interface DatosAcompanamiento {
  organizacionId: string
  nombre: string
  telefono: string
  autorizo: boolean
}

export const DATOS_VACIOS: DatosAcompanamiento = {
  organizacionId: '',
  nombre: '',
  telefono: '',
  autorizo: false,
}

/**
 * Si esos datos alcanzan para activar. Lo usan las dos pantallas que
 * montan estos campos, para no tener dos versiones de la misma regla.
 */
export function datosCompletos(d: DatosAcompanamiento) {
  return (
    d.organizacionId !== '' &&
    d.nombre.trim().length >= 3 &&
    (d.telefono === '' || validarTelefono(d.telefono) === null) &&
    d.autorizo
  )
}

/**
 * Los campos del acompañamiento, compartidos por el paso 4 de publicar y
 * por la pantalla de la solicitud.
 *
 * Vive aparte y no duplicado porque aquí está el TEXTO DE AUTORIZACIÓN, y
 * ese texto es la prueba del consentimiento: dos copias que se desincronicen
 * significa que una de las dos pantallas recogió un consentimiento que no
 * corresponde a lo que quedó guardado en `autorizacion_version`.
 */
export function CamposAcompanamiento({
  aliados,
  datos,
  onCambio,
}: {
  aliados: AliadoDelMunicipio[]
  datos: DatosAcompanamiento
  onCambio: (d: DatosAcompanamiento) => void
}) {
  const aliado = aliados.find((a) => a.id === datos.organizacionId) ?? null
  const errorTelefono = datos.telefono ? validarTelefono(datos.telefono) : null

  const cambiar = <K extends keyof DatosAcompanamiento>(
    campo: K,
    valor: DatosAcompanamiento[K]
  ) => onCambio({ ...datos, [campo]: valor })

  return (
    <div className="space-y-4">
      <p className="text-base text-muted-foreground">{AVISO_ACOMPANAMIENTO_DATOS}</p>

      {/* Con dirección y horario, que es lo que permite escoger la que
          quede más fácil. Sin eso, elegir entre nombres es adivinar. */}
      {aliados.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-base font-medium">¿Cuál te queda mejor?</legend>
          {/* Con hueco para la sombra de cartel de la opción elegida. */}
          <div className="space-y-3">
            {aliados.map((a) => (
              <label
                key={a.id}
                // Papel blanco con su canto, no un contorno: la identidad
                // separa las tarjetas del crema con una sombra de 1 px.
                // La elegida se lleva además la sombra de cartel, que es lo
                // que se ve de reojo sin buscar el punto del radio.
                className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-card p-3 shadow-canto has-checked:bg-accent has-checked:shadow-cartel-azul"
              >
                <input
                  type="radio"
                  name="aliado"
                  value={a.id}
                  checked={datos.organizacionId === a.id}
                  onChange={() => cambiar('organizacionId', a.id)}
                  className="mt-0.5 size-6 shrink-0"
                />
                <span>
                  <span className="text-base font-medium">{a.nombre}</span>
                  {a.direccion_acopio && (
                    <span className="block text-base text-muted-foreground">
                      {a.direccion_acopio}
                    </span>
                  )}
                  {a.horario_acopio && (
                    <span className="block text-base text-muted-foreground">
                      {a.horario_acopio}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {aliados.length === 1 && aliados[0].direccion_acopio && (
        <p className="text-base text-muted-foreground">
          Recoges en {aliados[0].direccion_acopio}
          {aliados[0].horario_acopio ? ` · ${aliados[0].horario_acopio}` : ''}.
        </p>
      )}

      <Alert variant="warning">
        <AlertDescription>{AVISO_ACOMPANAMIENTO_SIN_VUELTA}</AlertDescription>
      </Alert>

      <div>
        <Label htmlFor="acomp-nombre" className="mb-1">
          Tu nombre completo
        </Label>
        <Input
          id="acomp-nombre"
          value={datos.nombre}
          onChange={(e) => cambiar('nombre', e.target.value)}
          maxLength={80}
          autoComplete="name"
        />
      </div>

      {/* ⚠ Aquí había un tipo de documento y un número de cédula. Se
          fueron el 20/08/2026: la fundación comprueba la identidad
          mirando el documento en persona, que es lo que hacía de todos
          modos, y la plataforma deja de custodiar el dato más regulado
          que tenía. */}

      <div>
        <Label htmlFor="acomp-telefono" className="mb-1">
          Teléfono (opcional)
        </Label>
        <Input
          id="acomp-telefono"
          value={datos.telefono}
          onChange={(e) => cambiar('telefono', e.target.value)}
          maxLength={20}
          inputMode="tel"
          autoComplete="tel"
        />
        <p className="mt-1 text-base text-muted-foreground">
          Para que la fundación te avise de la entrega. Solo lo ve ella.
        </p>
        {errorTelefono && <p className="mt-1 text-base text-destructive">{errorTelefono}</p>}
      </div>

      {/* Solo con una fundación elegida. El consentimiento nombra a quien va
          a tratar los datos: sin nombre no hay a quién autorizar, y una
          casilla en abstracto no valdría nada. */}
      {aliado && (
        <label className="flex items-start gap-2 text-base">
          <input
            type="checkbox"
            checked={datos.autorizo}
            onChange={(e) => cambiar('autorizo', e.target.checked)}
            className="mt-1 size-5 shrink-0"
          />
          <span>
            Autorizo que {aliado.nombre} trate mi nombre y mi teléfono
            únicamente para coordinar esta entrega, según la{' '}
            <Link href="/privacidad" className="underline">
              política de privacidad
            </Link>{' '}
            del {FECHA_LEGALES}. Sé que se borran con la solicitud y que
            puedo pedir que se borren antes.
          </span>
        </label>
      )}
    </div>
  )
}
