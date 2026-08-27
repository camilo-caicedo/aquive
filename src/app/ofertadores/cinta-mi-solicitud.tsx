'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { PackageOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { OfertadorQueCalza } from '@/lib/types'
import { Button } from '@/components/ui/button'

interface Guardada {
  codigo: string
  token: string
  creada_at: string
}

const CLAVE = 'mis_solicitudes'

// El mismo store externo que `ListaLocal`: localStorage leído con
// `useSyncExternalStore`, que da un valor distinto en servidor (null) y en
// cliente sin desajuste de hidratación.
function suscribir(alCambiar: () => void) {
  window.addEventListener('storage', alCambiar)
  window.addEventListener('mis-solicitudes', alCambiar)
  return () => {
    window.removeEventListener('storage', alCambiar)
    window.removeEventListener('mis-solicitudes', alCambiar)
  }
}

const leerCliente = () => localStorage.getItem(CLAVE) ?? '[]'
const leerServidor = () => null

/**
 * La puerta de vuelta: de la lista pública a tu propia solicitud.
 *
 * Sin esto, quien ya publicó entra aquí, ve nombres de gente que tiene
 * cosas y no tiene ningún camino para saber cuáles le sirven — que es
 * justo lo que el cruce al revés vino a arreglar.
 *
 * ⚠ Se dibuja solo cuando hay coincidencias de verdad. El teléfono no sale
 * de aquí ni asomado: esta cinta solo cuenta y enlaza. El contacto vive
 * detrás de la cuenta, en `/mis-solicitudes`, de a uno.
 *
 * El token no viaja en ninguna query string: va en el path, como manda la
 * regla 6.
 */
export function CintaMiSolicitud() {
  const crudo = useSyncExternalStore(suscribir, leerCliente, leerServidor)
  const [total, setTotal] = useState<number | null>(null)

  const mia = useMemo<Guardada | null>(() => {
    if (crudo === null) return null
    try {
      // Se guardan con `unshift`, así que la primera es la más reciente.
      return (JSON.parse(crudo) as Guardada[])[0] ?? null
    } catch {
      return null
    }
  }, [crudo])

  useEffect(() => {
    if (!mia) return
    let cancelado = false

    async function contar(token: string) {
      const supabase = createClient()
      // `p_limite = 1`: la fila no se usa, solo su `total`, que la función
      // calcula sobre todo el conjunto antes de paginar.
      const { data } = await supabase.rpc('ofertadores_que_calzan', {
        p_token: token,
        p_limite: 1,
      })
      if (cancelado) return
      const filas = (data as unknown as OfertadorQueCalza[] | null) ?? []
      setTotal(filas.length > 0 ? filas[0].total : 0)
    }

    contar(mia.token)
    return () => {
      cancelado = true
    }
  }, [mia])

  // Sin solicitud guardada, o con solicitud pero sin nadie que calce, no
  // hay nada que decir: una cinta que anuncia un cero ocupa el sitio más
  // caro de la pantalla para dar una mala noticia.
  if (!mia || total === null || total === 0) return null

  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground">
      <PackageOpen className="size-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-base">
        <span className="font-semibold">
          {total} {total === 1 ? 'persona tiene' : 'personas tienen'}
        </span>{' '}
        algo de tu solicitud <span className="font-mono">{mia.codigo}</span>
      </p>
      <Button
        variant="outline"
        className="shrink-0 bg-background"
        nativeButton={false}
        render={<Link href="/mis-solicitudes" />}
      >
        Ver cuáles
      </Button>
    </div>
  )
}
