'use client'

import Link from 'next/link'
import { FECHA_LEGALES } from '@/lib/config'
import { TIPOS_DOCUMENTO, validarDocumento, validarTelefono } from '@/lib/validacion'
import {
  AVISO_ACOMPANAMIENTO_DATOS,
  AVISO_ACOMPANAMIENTO_SIN_VUELTA,
  type AliadoDelMunicipio,
} from '@/lib/acompanamiento'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { TipoDocumento } from '@/lib/types'

/** Lo que hace falta para activar el acompañamiento, en un solo objeto. */
export interface DatosAcompanamiento {
  organizacionId: string
  nombre: string
  documentoTipo: TipoDocumento
  documento: string
  telefono: string
  autorizo: boolean
}

export const DATOS_VACIOS: DatosAcompanamiento = {
  organizacionId: '',
  nombre: '',
  documentoTipo: 'CC',
  documento: '',
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
    d.documento.trim().length > 0 &&
    validarDocumento(d.documentoTipo, d.documento) === null &&
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
  const errorDocumento = datos.documento
    ? validarDocumento(datos.documentoTipo, datos.documento)
    : null
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
          <div className="space-y-2">
            {aliados.map((a) => (
              <label
                key={a.id}
                className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-accent"
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
                    <span className="block text-sm text-muted-foreground">
                      {a.direccion_acopio}
                    </span>
                  )}
                  {a.horario_acopio && (
                    <span className="block text-sm text-muted-foreground">
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

      <fieldset>
        <legend className="mb-2 text-base font-medium">Tipo de documento</legend>
        {/* Sin TI ni RC, y no es un olvido: esta plataforma no recibe
            documentos de menores de edad (regla O). Un CHECK de la base los
            rechaza aunque alguien los mande a mano. */}
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_DOCUMENTO.map((t) => (
            <Button
              key={t.valor}
              type="button"
              variant={datos.documentoTipo === t.valor ? 'default' : 'outline'}
              onClick={() => cambiar('documentoTipo', t.valor)}
            >
              {t.valor}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {TIPOS_DOCUMENTO.find((t) => t.valor === datos.documentoTipo)?.etiqueta}
        </p>
      </fieldset>

      <div>
        <Label htmlFor="acomp-documento" className="mb-1">
          Número de documento
        </Label>
        <Input
          id="acomp-documento"
          value={datos.documento}
          onChange={(e) => cambiar('documento', e.target.value)}
          maxLength={20}
          inputMode="numeric"
        />
        {errorDocumento && <p className="mt-1 text-sm text-destructive">{errorDocumento}</p>}
      </div>

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
        <p className="mt-1 text-sm text-muted-foreground">
          Para que la fundación te avise de la entrega. Solo lo ve ella.
        </p>
        {errorTelefono && <p className="mt-1 text-sm text-destructive">{errorTelefono}</p>}
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
            Autorizo que {aliado.nombre} trate estos datos para coordinar la
            entrega, según la{' '}
            <Link href="/privacidad" className="underline">
              política de privacidad
            </Link>{' '}
            del {FECHA_LEGALES}.
          </span>
        </label>
      )}
    </div>
  )
}
