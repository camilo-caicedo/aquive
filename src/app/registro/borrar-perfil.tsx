'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

type Estado = 'inicial' | 'confirmando' | 'borrando' | 'error'

export function BorrarPerfil({ tienePerfil }: { tienePerfil: boolean }) {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('inicial')

  async function borrar() {
    setEstado('borrando')
    try {
      const res = await fetch('/api/perfil', { method: 'DELETE' })
      if (!res.ok) {
        setEstado('error')
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setEstado('error')
    }
  }

  // ⚠ Sin cromo propio: la tarjeta de «Borrar mi cuenta» que lo contiene
  // ya trae el título y la consecuencia escrita. Antes esto añadía otro
  // <h2> y otro párrafo casi idéntico justo debajo.
  return (
    <div>
      {!tienePerfil && (
        <p className="text-base text-muted-foreground">
          Todavía no has creado un perfil, pero puedes borrar tu cuenta y con
          ella el identificador de Google que guardamos.
        </p>
      )}

      {estado === 'error' && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>
            No se pudo borrar. Intenta de nuevo o escríbenos.
          </AlertDescription>
        </Alert>
      )}

      {estado === 'confirmando' ? (
        <div className="mt-3 rounded-2xl bg-background p-4">
          <p className="text-base font-semibold">
            ¿Seguro? Esto borra tu cuenta y todo lo que hayas publicado, para
            siempre. Si alguien estaba esperando tu respuesta, dejará de verla.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEstado('inicial')}
            >
              Cancelar
            </Button>
            {/* Rojo pastel de la sombrilla con tinta negra (5,67:1): es
                relleno, no letra roja sobre claro. */}
            <Button
              className="flex-1 bg-familia-rojo text-foreground hover:bg-familia-rojo/85"
              disabled={estado !== 'confirmando'}
              onClick={borrar}
            >
              Sí, borrar todo
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="mt-3 w-full bg-familia-rojo text-foreground hover:bg-familia-rojo/85 sm:w-auto"
          disabled={estado === 'borrando'}
          onClick={() => setEstado('confirmando')}
        >
          <Trash2 className="size-5" aria-hidden="true" />
          {estado === 'borrando' ? 'Borrando…' : 'Borrar mi cuenta y mis datos'}
        </Button>
      )}
    </div>
  )
}
