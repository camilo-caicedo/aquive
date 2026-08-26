'use client'

import { useState, type ReactNode } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { HojaAccion } from '@/components/hoja-accion'

/** Lo mismo que ya exige `PanelReferencias`, dicho en un sitio. */
const MINIMO_MOTIVO = 5

/**
 * La regla 11 hecha componente: el dato sensible se destapa de uno en uno,
 * con motivo escrito en ese momento, y se ve que quedó registrado.
 *
 * Ninguna lista de esta aplicación trae nombres, teléfonos ni documentos de
 * terceros. Se abren uno por uno y por aquí, que es lo que hace que la
 * bitácora sirva de prueba: si la lista llegara ya destapada, «quién leyó
 * qué» sería una fila por página cargada y no diría nada.
 *
 * ⚠ Si mañana aparece otra lectura de identidad y no pasa por aquí, es un
 * bug. Hoy la usan `leer_referencia` y `exportar_planilla`.
 *
 * Lo destapado vive en memoria a propósito: al recargar desaparece, y eso
 * se dice en pantalla en vez de dejar que la persona lo descubra.
 */
export function HojaDatoSensible({
  id,
  titulo,
  explicacion,
  etiquetaBoton = 'Ver',
  alAbrir,
  children,
}: {
  id: string
  titulo: string
  /** Qué se va a destapar y qué se va a registrar. */
  explicacion: ReactNode
  etiquetaBoton?: string
  /** Llama a la RPC con el motivo escrito. Devuelve el error, o null. */
  alAbrir: (motivo: string) => Promise<string | null>
  /** Pinta lo destapado. Solo se llama si `alAbrir` salió bien. */
  children: ReactNode
}) {
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)

  async function destapar() {
    if (motivo.trim().length < MINIMO_MOTIVO) return
    setCargando(true)
    setError(null)
    const fallo = await alAbrir(motivo.trim())
    setCargando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setAbierto(true)
  }

  return (
    <HojaAccion
      id={id}
      titulo={titulo}
      disparador={(props) => (
        <Button {...props} variant="outline" className="w-full">
          <Eye className="size-5" aria-hidden="true" />
          {etiquetaBoton}
        </Button>
      )}
    >
      {!abierto ? (
        <>
          <p className="text-base text-muted-foreground">{explicacion}</p>

          <div>
            <Label htmlFor={`${id}-motivo`}>Para qué lo necesitas</Label>
            <Input
              id={`${id}-motivo`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
              placeholder="Ej: confirmar la entrega del martes"
              className="mt-1"
            />
            <p className="mt-1.5 text-base text-muted-foreground">
              Se escribe ahora y queda en la bitácora junto a tu nombre y la
              hora. Mínimo {MINIMO_MOTIVO} caracteres.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            disabled={cargando || motivo.trim().length < MINIMO_MOTIVO}
            onClick={destapar}
          >
            {cargando ? 'Un momento…' : etiquetaBoton}
          </Button>
        </>
      ) : (
        <>
          {children}

          {/* Después, y no en letra pequeña antes: es lo que la persona
              tiene que saber ya que lo hizo (regla 11). Tarjeta de cartel y
              no un aviso apagado — que quede registrado es la mitad del
              trato, y decirlo bajito sería quedarse con la otra mitad. */}
          <div className="rounded-2xl bg-card p-4 shadow-cartel-verde">
            <p className="font-heading text-base leading-snug">
              Esta lectura quedó registrada en la bitácora
            </p>
            <p className="mt-1.5 text-base leading-relaxed">
              Con tu nombre, la hora y el motivo que escribiste. Lo de arriba no
              se guarda en esta pantalla: si recargas, desaparece.
            </p>
          </div>
        </>
      )}
    </HojaAccion>
  )
}
