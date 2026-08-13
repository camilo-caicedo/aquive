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

  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="text-xl font-bold">Borrar mi cuenta</h2>
      <p className="mt-2 text-base text-muted-foreground">
        {tienePerfil
          ? 'Se borra tu perfil, tu matrícula y todas las respuestas que hayas enviado. También se borra tu cuenta: no queda nada tuyo, ni siquiera el identificador de Google.'
          : 'Todavía no has creado un perfil, pero puedes borrar tu cuenta y con ella el identificador de Google que guardamos.'}{' '}
        Es inmediato y no se puede deshacer.
      </p>

      {estado === 'error' && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>
            No se pudo borrar. Intenta de nuevo o escríbenos.
          </AlertDescription>
        </Alert>
      )}

      {estado === 'confirmando' ? (
        <div className="mt-3 rounded-lg border-2 border-destructive p-4">
          <p className="text-base">
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
            <Button
              variant="destructive"
              className="flex-1"
              disabled={estado !== 'confirmando'}
              onClick={borrar}
            >
              Sí, borrar todo
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="destructive"
          className="mt-3 w-full sm:w-auto"
          disabled={estado === 'borrando'}
          onClick={() => setEstado('confirmando')}
        >
          <Trash2 className="size-5" aria-hidden="true" />
          {estado === 'borrando' ? 'Borrando…' : 'Borrar mi cuenta y mis datos'}
        </Button>
      )}
    </section>
  )
}
