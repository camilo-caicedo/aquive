import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { EstadoEncabezado } from '@/lib/types'
import { ListaLocal } from './lista-local'

export const metadata = { title: 'Mis solicitudes' }

// `/aliado` tiene dos públicos y por eso dos nombres. Para el equipo de una
// fundación es su organización; para quien solo ofreció ayuda es el sitio
// donde están sus conversaciones, y llamárselo «Mi organización» sería
// mentirle. Quien no tenga ninguna de las dos cosas no ve la fila.
const ETIQUETA_COORDINACION: Record<string, string> = {
  organizacion: 'Mi organización',
  coordinacion: 'Coordinación',
}

function Fila({ href, etiqueta, detalle }: { href: string; etiqueta: string; detalle: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
    >
      <span>
        <span className="block text-base font-medium">{etiqueta}</span>
        <span className="block text-sm text-muted-foreground">{detalle}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

export default async function MisSolicitudesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // La misma consulta que ya hace el encabezado. Se pide aquí porque la
  // celda «Lo mío» reemplazó a la quinta celda de la barra, que era la
  // única puerta a /aliado: sin esto, quien coordina se queda sin panel
  // salvo que se sepa la URL de memoria.
  const { data: estado } = user
    ? await supabase.rpc('estado_encabezado')
    : { data: null }
  const coordinacion = (estado as EstadoEncabezado | null)?.coordinacion ?? null

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-heading text-3xl">Mis solicitudes</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Guardadas solo en este teléfono. Si cambias de teléfono o borras los
        datos del navegador, se pierden: no las tenemos guardadas en ningún
        lado.
      </p>
      <ListaLocal />

      {/* Lo demás que es «mío» y no cabe en la barra: el perfil de quien
          ofrece, y el panel de coordinación cuando aplica. En la fase 3
          esto se convierte en las pestañas de «Lo mío»; por ahora son dos
          filas, que es lo que hace falta para que ninguna pantalla quede
          sin puerta. */}
      <nav aria-label="Lo mío" className="mt-8 flex flex-col gap-2">
        {coordinacion && ETIQUETA_COORDINACION[coordinacion] && (
          <Fila
            href="/aliado"
            etiqueta={ETIQUETA_COORDINACION[coordinacion]}
            detalle="Las entregas que estás coordinando"
          />
        )}
        {user ? (
          <Fila
            href="/registro"
            etiqueta="Mi perfil"
            detalle="Lo que ofreces, tus municipios y tus respuestas"
          />
        ) : (
          <Fila
            href="/login"
            etiqueta="Entrar para ofrecer ayuda"
            detalle="Solo hace falta cuenta para ofrecer, no para pedir"
          />
        )}
      </nav>
    </main>
  )
}
