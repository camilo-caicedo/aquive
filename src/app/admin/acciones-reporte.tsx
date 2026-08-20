'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { TipoObjetoReporte } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Qué se lleva por delante «Borrar contenido», por tipo de objeto.
 *
 * ⚠ Sale de leer `resolver_reporte`, no de suponerlo: la función NO borra
 * lo mismo en todos los casos. Una solicitud se borra entera, una
 * respuesta también, pero un perfil solo se suspende y una entidad solo se
 * retira. Decir «se borra para siempre» en los cuatro sería mentir en dos.
 */
const CONSECUENCIA: Partial<Record<TipoObjetoReporte, string>> = {
  solicitud:
    'Se borra la solicitud entera, con sus respuestas, y quien la publicó pierde su enlace. Queda solo la métrica anónima.',
  respuesta:
    'Quien pidió ayuda deja de verla. Si además hay que suspender el perfil, eso se hace aparte.',
  perfil:
    'El perfil queda suspendido: deja de aparecer en la plataforma y no puede responder. No se borra.',
  entidad:
    'La entidad se retira del directorio y deja de verse. No se borra: se puede volver a publicar sin reescribirla.',
}

export function AccionesReporte({
  reporteId,
  tipoObjeto,
  existe,
}: {
  reporteId: string
  tipoObjeto: TipoObjetoReporte
  /** Si el objeto sigue existiendo. Si no, solo se puede descartar. */
  existe: boolean
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const consecuencia = CONSECUENCIA[tipoObjeto]

  async function resolver(borrar: boolean) {
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('resolver_reporte', {
      p_reporte_id: reporteId,
      p_borrar: borrar,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    router.refresh()
  }

  // Fichas de servicios y calificaciones: `resolver_reporte` no las toca,
  // así que ofrecer «borrar» aquí sería un botón que marca el reporte como
  // atendido y no hace nada más. Se modera desde su propia pantalla.
  const soloDescartar = !existe || !consecuencia

  return (
    <div className="mt-3">
      {confirmando ? (
        <>
          <p className="text-sm font-medium text-destructive">
            ¿Seguro? No se puede deshacer.
          </p>
          {consecuencia && (
            <p className="mt-1 text-sm text-muted-foreground">{consecuencia}</p>
          )}
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="destructive"
              className="h-11 text-sm"
              disabled={enviando}
              onClick={() => resolver(true)}
            >
              {enviando ? 'Borrando…' : 'Sí, borrar'}
            </Button>
            <Button
              variant="outline"
              className="h-11 text-sm"
              disabled={enviando}
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <>
          {soloDescartar && (
            <p className="mb-2 text-sm text-muted-foreground">
              {!existe ? (
                'Lo reportado ya no existe: se borró o venció. Solo queda descartar el reporte.'
              ) : (
                <>
                  Esto no se modera desde aquí.{' '}
                  <Link href="/admin/servicios" className="underline underline-offset-4">
                    Ábrelo en Servicios
                  </Link>{' '}
                  para ocultarlo o borrarlo, y descarta el reporte cuando
                  esté resuelto.
                </>
              )}
            </p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {!soloDescartar && (
              <Button
                variant="destructive"
                className="h-11 text-sm"
                disabled={enviando}
                onClick={() => setConfirmando(true)}
              >
                Borrar contenido
              </Button>
            )}
            <Button
              variant="outline"
              className="h-11 text-sm"
              disabled={enviando}
              onClick={() => resolver(false)}
            >
              {enviando ? 'Guardando…' : 'Descartar'}
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Descartar deja el contenido como está y saca el reporte de la
            cola.
          </p>
        </>
      )}

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
