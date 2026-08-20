import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { MessageSquare } from 'lucide-react'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Estado } from '@/components/estado'
import { createClient } from '@/lib/supabase/server'
import type { HiloResumen } from '@/lib/types'
import { PanelHilos } from '../aliado/panel-hilos'

export const metadata: Metadata = {
  title: 'Mensajes',
  robots: { index: false, follow: false },
}

/**
 * Las conversaciones de quien ofreció ayuda en una solicitud acompañada.
 *
 * ⚠ Existe porque `/aliado` servía a dos públicos a la vez y eso se le
 * notaba. Quien ofrece ayuda no pertenece a ninguna organización y aun así
 * tiene hilos que leer, así que aterrizaba en el panel de una fundación:
 * con el título de una organización que no es la suya y con las tres colas
 * de `PanelHilos` —«Sin asignar», «Mías», «Entregadas»—, que son conceptos
 * de quien coordina. Peor todavía: la cola por defecto era «Sin asignar»,
 * que para él está SIEMPRE vacía —excluye los hilos propios—, así que lo
 * primero que veía era una lista en blanco.
 *
 * Aquí no hay colas ni pestañas. Es una lista y ya: todos estos hilos son
 * suyos, y una navegación con una sola opción no es navegación.
 *
 * Quien sí es aliado no entra: se va a `/aliado`, que es su sitio y tiene
 * más cosas.
 */
export default async function CoordinacionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: esAliado } = await supabase.rpc('soy_aliado')
  if (esAliado) redirect('/aliado')

  const { data: hilosData } = await supabase.rpc('mis_hilos')
  const hilos = (hilosData as unknown as HiloResumen[]) ?? []

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Mensajes">
        <p className="mt-1 text-base text-muted-foreground">
          Las entregas que estás coordinando con una fundación.
        </p>
      </CabeceraPantalla>

      {hilos.length === 0 ? (
        <Estado
          Icono={MessageSquare}
          titulo="Todavía no tienes conversaciones"
          detalle="Aparecen aquí cuando ofreces ayuda en una solicitud que acompaña una fundación."
        />
      ) : (
        <PanelHilos hilos={hilos} conColas={false} volverA="/coordinacion" />
      )}
    </main>
  )
}
