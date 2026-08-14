'use client'

import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

// No se muestra ni se registra el detalle del error: podría arrastrar
// contenido de la solicitud (CLAUDE.md regla 6, sin PII en logs).
export default function ErrorGlobal({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-12 text-center">
      <TriangleAlert className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="font-heading mt-4 text-3xl">Algo falló de nuestro lado</h1>
      <p className="mt-2 text-base text-muted-foreground">
        No es culpa tuya y no perdiste nada. Si tenías el enlace de tu
        solicitud, sigue sirviendo.
      </p>
      <Button className="mt-6 w-full" onClick={reset}>
        Intentar de nuevo
      </Button>
    </main>
  )
}
