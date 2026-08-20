'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Renovar, cerrar y borrar. El token va en el cuerpo del POST, nunca en
 * la URL de la petición (regla 6).
 *
 * Borrar no pregunta dos veces ni pide motivo: es el habeas data de quien
 * publicó, y un borrado que hay que negociar no es un borrado.
 */
export function AccionesSolicitudServicio({
  token,
  estado,
  dias,
}: {
  token: string
  estado: 'abierta' | 'resuelta'
  /**
   * Días que le quedan, calculados en el servidor. No se calcula aquí:
   * `Date.now()` durante el render es impuro y además haría que el número
   * dependiera del reloj del teléfono, que en estos aparatos se va.
   */
  dias: number
}) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accion(nombre: 'renovar' | 'resolver' | 'borrar') {
    if (
      nombre === 'borrar' &&
      !confirm('¿Seguro? Se borra la solicitud y las respuestas. Esto no se puede deshacer.')
    ) {
      return
    }
    setOcupado(true)
    setError(null)

    const respuesta = await fetch('/api/servicios/solicitudes/gestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, accion: nombre }),
    })
    const datos = await respuesta.json()
    setOcupado(false)

    if (!respuesta.ok) {
      setError(datos.error ?? 'No se pudo')
      return
    }

    if (nombre === 'borrar') {
      router.push('/servicios')
      return
    }
    router.refresh()
  }

  return (
    <section className="mt-10 border-t border-border pt-6">
      <p className="text-base text-muted-foreground">
        {dias === 0
          ? 'Se borra hoy.'
          : dias === 1
            ? 'Se borra sola mañana.'
            : `Se borra sola en ${dias} días.`}{' '}
        Puedes renovarla, cerrarla o borrarla ahora mismo.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="sm:flex-1"
          onClick={() => accion('renovar')}
          disabled={ocupado}
        >
          Renovar 15 días más
        </Button>
        {estado === 'abierta' && (
          <Button
            variant="outline"
            className="sm:flex-1"
            onClick={() => accion('resolver')}
            disabled={ocupado}
          >
            Ya lo resolví
          </Button>
        )}
        <Button
          variant="outline"
          className="sm:flex-1"
          onClick={() => accion('borrar')}
          disabled={ocupado}
        >
          Borrar ahora
        </Button>
      </div>
    </section>
  )
}
