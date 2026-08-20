'use client'

import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Estado } from '@/components/estado'

// No se muestra ni se registra el detalle del error: podría arrastrar
// contenido de la solicitud (CLAUDE.md regla 6, sin PII en logs).
export default function ErrorGlobal({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Estado
        Icono={TriangleAlert}
        titulo="Algo falló de nuestro lado"
        detalle="No es culpa tuya y no perdiste nada. Si tenías el enlace de tu solicitud, sigue sirviendo."
        accion={<Button onClick={reset}>Intentar de nuevo</Button>}
      />
    </main>
  )
}
