'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HeartHandshake } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FECHA_LEGALES } from '@/lib/config'
import { type AliadoDelMunicipio } from '@/lib/acompanamiento'
import {
  CamposAcompanamiento,
  DATOS_VACIOS,
  datosCompletos,
  type DatosAcompanamiento,
} from '@/components/campos-acompanamiento'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * La segunda oportunidad, no la primera.
 *
 * Desde agosto de 2026 el acompañamiento se ofrece en el paso 4 de
 * publicar, que es donde de verdad se ve. Esto sigue existiendo para quien
 * dijo que no y a los dos días, sin respuestas, cambia de opinión: por eso
 * empieza cerrado y detrás de un enlace, no de un botón. Se ofrece una
 * vez, no se pide dos (regla R).
 *
 * No hay camino de vuelta desde aquí (§7). Se dice antes de pedir nada.
 */
export function Acompanamiento({
  token,
  aliados,
  flujo,
  organizacion,
}: {
  token: string
  aliados: AliadoDelMunicipio[]
  flujo: 'directo' | 'acompanado'
  organizacion: string | null
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [datos, setDatos] = useState<DatosAcompanamiento>({
    ...DATOS_VACIOS,
    // Con una sola no hay nada que escoger. Con varias no se preselecciona
    // ninguna: elegir por la persona cuál fundación ve su documento no es
    // una comodidad, es una decisión que no nos toca.
    organizacionId: aliados.length === 1 ? aliados[0].id : '',
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ya acompañada: se dice y se acabó. No se le vuelven a mostrar los
  // datos que entregó — mostrarlos no le sirve de nada y multiplica los
  // sitios por donde pueden salir.
  if (flujo === 'acompanado') {
    return (
      <section className="mt-8">
        <div className="rounded-xl border border-ok/30 bg-ok-suave p-4">
          <p className="flex items-start gap-2 text-base text-ok">
            <HeartHandshake className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
            <span>
              {organizacion ?? 'Una fundación'} está acompañando esta
              solicitud. Ellos coordinan la entrega contigo.
            </span>
          </p>
        </div>
      </section>
    )
  }

  // Sin fundación en ese municipio no hay nada que ofrecer, y no se
  // menciona: contar lo que no existe solo hace sentir que falta algo.
  if (aliados.length === 0) return null

  const puedeEnviar = datosCompletos(datos) && !enviando

  async function activar() {
    if (!puedeEnviar) return
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('activar_acompanamiento', {
      p_token: token,
      p_organizacion_id: datos.organizacionId,
      p_nombre: datos.nombre.trim(),
      p_autorizacion_version: FECHA_LEGALES,
      p_telefono: datos.telefono.trim() || null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    // La activación va directo a Supabase —lleva nombre, documento y
    // teléfono, y no tienen por qué pasar por Vercel—. Lo que sí pasa por
    // una ruta es el aviso a quienes ya habían ofrecido ayuda, porque las
    // suscripciones push no son legibles para el navegador.
    await fetch('/api/acompanamiento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => {})

    router.refresh()
  }

  return (
    <section className="mt-8">
      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex min-h-12 items-center gap-1.5 text-left text-base text-muted-foreground underline"
        >
          <HeartHandshake className="size-4 shrink-0" aria-hidden="true" />
          ¿Prefieres que una fundación coordine la entrega?
        </button>
      ) : (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <h2 className="font-heading text-2xl">Que una fundación te acompañe</h2>

          <CamposAcompanamiento aliados={aliados} datos={datos} onCambio={setDatos} />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setAbierto(false)}
            >
              Ahora no
            </Button>
            <Button type="button" className="flex-1" disabled={!puedeEnviar} onClick={activar}>
              {enviando ? 'Guardando…' : 'Sí, que me acompañen'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
