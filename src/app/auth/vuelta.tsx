'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { recogerDestino } from '@/lib/destino'

/**
 * Recoge el destino guardado antes de ir a Google y vuelve a él.
 *
 * Se monta en la pantalla a la que cae el callback. Si no hay destino
 * guardado —o el guardado no está en la lista blanca— no hace nada y la
 * persona se queda donde el callback la dejó, que es el comportamiento de
 * siempre.
 *
 * ⚠ Va aquí y no en el callback porque `sessionStorage` es del navegador:
 * el route handler corre en el servidor y no puede leerlo. Y por eso mismo
 * el destino nunca pudo viajar en la URL sin abrir un redirect abierto.
 */
export function VueltaAlDestino() {
  const router = useRouter()

  useEffect(() => {
    const destino = recogerDestino()
    if (destino) router.replace(destino)
  }, [router])

  return null
}
